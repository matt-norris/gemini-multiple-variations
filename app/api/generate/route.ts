import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

export const maxDuration = 300;

interface ReferenceImage {
    data: string;
    mimeType: string;
}

interface GenerateRequest {
    prompt: string;
    negativePrompt: string;
    count: number;
    aspectRatio: string;
    imageSize: string;
    model: string;
    referenceImages: ReferenceImage[];
    enableSearch: boolean;
    generationMode: "variations" | "same";
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
    const {
        prompt,
        negativePrompt,
        count,
        aspectRatio,
        imageSize,
        model,
        referenceImages,
        enableSearch,
        generationMode,
    } = body;

    if (!prompt) {
        return new Response(
            JSON.stringify({ error: "Prompt is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Determine model name
    const modelName =
        model === "flash" ? "gemini-2.5-flash-image" : "gemini-3-pro-image-preview";

    // Flash model only supports up to 3 ref images, Pro supports up to 14
    const maxRefImages = model === "flash" ? 3 : 14;
    const images = (referenceImages || []).slice(0, maxRefImages);

    // Flash only supports 1K
    const resolvedImageSize =
        model === "flash" ? undefined : imageSize || "1K";

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
                    // Add variation instruction for subsequent images (only in variations mode)
                    if (i > 0 && generationMode !== "same") {
                        fullPrompt += `\n\nGenerate a unique variation #${i + 1}. Make it distinctly different from previous variations while keeping the same subject and theme.`;
                    }

                    // Build parts array: text + reference images
                    const requestParts: Array<
                        | { text: string }
                        | { inlineData: { data: string; mimeType: string } }
                    > = [{ text: fullPrompt }];

                    // Add reference images as inline data parts
                    for (const img of images) {
                        requestParts.push({
                            inlineData: {
                                data: img.data,
                                mimeType: img.mimeType || "image/png",
                            },
                        });
                    }

                    // Build config
                    const config: Record<string, unknown> = {
                        responseModalities: ["IMAGE", "TEXT"] as string[],
                        imageConfig: {
                            aspectRatio: aspectRatio || "1:1",
                            ...(resolvedImageSize && { imageSize: resolvedImageSize }),
                        },
                    };

                    // Add Google Search tool if enabled (Pro model only)
                    if (enableSearch && model !== "flash") {
                        config.tools = [{ googleSearch: {} }];
                    }

                    const contents = [
                        {
                            role: "user" as const,
                            parts: requestParts,
                        },
                    ];

                    // Use streaming — keepalive chunks prevent network timeouts
                    // on long-running Pro model generations (2-10 min)
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
                            if (part?.inlineData) {
                                const data = JSON.stringify({
                                    type: "image",
                                    index: i,
                                    mimeType: part.inlineData.mimeType,
                                    data: part.inlineData.data,
                                });
                                controller.enqueue(
                                    encoder.encode(`data: ${data}\n\n`)
                                );
                                imageFound = true;
                            } else if (part?.text && !part.thought) {
                                const data = JSON.stringify({
                                    type: "text",
                                    index: i,
                                    text: part.text,
                                });
                                controller.enqueue(
                                    encoder.encode(`data: ${data}\n\n`)
                                );
                            }
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
