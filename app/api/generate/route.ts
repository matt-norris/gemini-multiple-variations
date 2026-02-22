import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

export const maxDuration = 120;

interface GenerateRequest {
    prompt: string;
    negativePrompt: string;
    count: number;
    aspectRatio: string;
    imageSize: string;
}

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    const body: GenerateRequest = await req.json();
    const { prompt, negativePrompt, count, aspectRatio, imageSize } = body;

    if (!prompt) {
        return new Response(
            JSON.stringify({ error: "Prompt is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const ai = new GoogleGenAI({ apiKey });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const imageCount = Math.min(Math.max(count || 1, 1), 8);

            for (let i = 0; i < imageCount; i++) {
                try {
                    // Build the prompt text
                    let fullPrompt = prompt;
                    if (negativePrompt) {
                        fullPrompt += `\n\nNegative prompt (avoid these): ${negativePrompt}`;
                    }
                    // Add variation instruction for subsequent images
                    if (i > 0) {
                        fullPrompt += `\n\nGenerate a unique variation #${i + 1}. Make it distinctly different from previous variations while keeping the same subject and theme.`;
                    }

                    const config = {
                        responseModalities: ["IMAGE", "TEXT"] as string[],
                        imageConfig: {
                            aspectRatio: aspectRatio || "1:1",
                            imageSize: imageSize || "1K",
                        },
                    };

                    const contents = [
                        {
                            role: "user" as const,
                            parts: [{ text: fullPrompt }],
                        },
                    ];

                    const response = await ai.models.generateContentStream({
                        model: "gemini-3-pro-image-preview",
                        config,
                        contents,
                    });

                    let imageFound = false;
                    for await (const chunk of response) {
                        if (
                            !chunk.candidates ||
                            !chunk.candidates[0]?.content?.parts
                        ) {
                            continue;
                        }

                        const part = chunk.candidates[0].content.parts[0];
                        if (part?.inlineData) {
                            const data = JSON.stringify({
                                type: "image",
                                index: i,
                                mimeType: part.inlineData.mimeType,
                                data: part.inlineData.data,
                            });
                            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                            imageFound = true;
                        } else if (chunk.text) {
                            const data = JSON.stringify({
                                type: "text",
                                index: i,
                                text: chunk.text,
                            });
                            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                        }
                    }

                    if (!imageFound) {
                        const data = JSON.stringify({
                            type: "error",
                            index: i,
                            error: "No image was generated for this variation",
                        });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                } catch (err) {
                    const errorMessage =
                        err instanceof Error ? err.message : "Unknown error";
                    const data = JSON.stringify({
                        type: "error",
                        index: i,
                        error: errorMessage,
                    });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
            }

            // Signal done
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            );
            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
