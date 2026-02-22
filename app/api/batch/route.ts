import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

export const maxDuration = 300;

interface BatchRequest {
    prompts: string[];
    negativePrompt: string;
    aspectRatio: string;
    imageSize: string;
    model: string;
}

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    const body: BatchRequest = await req.json();
    const { prompts, negativePrompt, aspectRatio, imageSize, model } = body;

    if (!prompts || prompts.length === 0) {
        return new Response(
            JSON.stringify({ error: "At least one prompt is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName =
        model === "flash" ? "gemini-2.5-flash-image" : "gemini-3-pro-image-preview";
    const resolvedImageSize = model === "flash" ? undefined : imageSize || "1K";

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Send total count
            controller.enqueue(
                encoder.encode(
                    `data: ${JSON.stringify({ type: "total", count: prompts.length })}\n\n`
                )
            );

            for (let i = 0; i < prompts.length; i++) {
                try {
                    const config: Record<string, unknown> = {
                        responseModalities: ["IMAGE", "TEXT"] as string[],
                        imageConfig: {
                            aspectRatio: aspectRatio || "1:1",
                            ...(resolvedImageSize && { imageSize: resolvedImageSize }),
                        },
                    };

                    let fullPrompt = prompts[i];
                    if (negativePrompt) {
                        fullPrompt += `\n\nNegative prompt (avoid these): ${negativePrompt}`;
                    }

                    const contents = [
                        {
                            role: "user" as const,
                            parts: [{ text: fullPrompt }],
                        },
                    ];

                    const response = await ai.models.generateContentStream({
                        model: modelName,
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

                        for (const part of chunk.candidates[0].content.parts) {
                            if (part?.inlineData && !part.thought) {
                                const data = JSON.stringify({
                                    type: "image",
                                    index: i,
                                    prompt: prompts[i],
                                    mimeType: part.inlineData.mimeType,
                                    data: part.inlineData.data,
                                });
                                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                                imageFound = true;
                                break; // Only take the first image per prompt
                            }
                        }
                        if (imageFound) break;
                    }

                    if (!imageFound) {
                        const data = JSON.stringify({
                            type: "error",
                            index: i,
                            prompt: prompts[i],
                            error: "No image generated for this prompt",
                        });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                } catch (err) {
                    const errorMessage =
                        err instanceof Error ? err.message : "Unknown error";
                    const data = JSON.stringify({
                        type: "error",
                        index: i,
                        prompt: prompts[i],
                        error: errorMessage,
                    });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
            }

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
