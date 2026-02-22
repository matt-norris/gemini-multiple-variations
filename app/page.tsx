"use client";

import { useState, useCallback } from "react";

interface GeneratedImage {
    type: "image";
    index: number;
    mimeType: string;
    data: string;
}

interface GeneratedError {
    type: "error";
    index: number;
    error: string;
}

type GalleryItem = GeneratedImage | GeneratedError;

const ASPECT_RATIOS = [
    { label: "1:1", subtitle: "Square", value: "1:1", w: 18, h: 18 },
    { label: "16:9", subtitle: "Landscape", value: "16:9", w: 24, h: 14 },
    { label: "9:16", subtitle: "Portrait", value: "9:16", w: 12, h: 22 },
    { label: "4:3", subtitle: "Classic", value: "4:3", w: 22, h: 16 },
    { label: "3:4", subtitle: "Tall", value: "3:4", w: 16, h: 22 },
];

const IMAGE_SIZES = [
    { label: "512px", value: "512" },
    { label: "1K", value: "1K" },
    { label: "2K", value: "2K" },
];

const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

interface NegativePreset {
    id: string;
    name: string;
    icon: string;
    color: string;
    prompts: string;
}

const NEGATIVE_PRESETS: NegativePreset[] = [
    {
        id: "general",
        name: "General Quality",
        icon: "\u2726",
        color: "#a1a1aa",
        prompts: "worst quality, low quality, blurry, pixelated, grainy, jpeg artifacts, watermark, text, signature, logo, overexposed, underexposed, cropped, out of frame, out of focus, ugly, error",
    },
    {
        id: "photorealistic",
        name: "Photorealistic",
        icon: "\u25CB",
        color: "#3b82f6",
        prompts: "cartoon, anime, illustration, painting, drawing, sketch, 3d render, cgi, digital art, artwork, 2d, flat, monochrome, unrealistic, artificial, plastic, fake, bad photography, grainy, noisy, worst quality, blurry, watermark",
    },
    {
        id: "cartoon",
        name: "Cartoon / Illustration",
        icon: "\u25B3",
        color: "#f97316",
        prompts: "photorealistic, realistic, photo, photography, 3d, hyperrealistic, unnatural shading, blurry outlines, uninspired, generic, amateurish, incomplete, messy, cluttered, unappealing colors, inconsistent art style, worst quality, watermark, text",
    },
    {
        id: "portrait",
        name: "Portrait",
        icon: "\u25C7",
        color: "#ec4899",
        prompts: "bad anatomy, wrong anatomy, deformed, disfigured, mutated, extra limbs, extra fingers, missing fingers, poorly drawn hands, poorly drawn face, cloned face, asymmetrical face, distorted features, ugly textures, bad hair, long neck, flat lighting, awkward angles, stiff pose, unnatural expression, worst quality, blurry, watermark",
    },
    {
        id: "landscape",
        name: "Landscape / Nature",
        icon: "\u25C6",
        color: "#22c55e",
        prompts: "people, person, buildings, urban, vehicles, cars, text, watermark, simple background, plain background, overexposed, underexposed, distorted, deformed structures, low contrast, dark, macro, portrait, multiple angles, white spots, worst quality, blurry",
    },
    {
        id: "abstract",
        name: "Abstract Art",
        icon: "\u25CE",
        color: "#a855f7",
        prompts: "photorealistic, realistic, photo, text, watermark, logo, face, person, recognizable objects, cluttered, busy, muddy colors, low contrast, grainy, pixelated, worst quality, blurry, generic, cliched, low resolution",
    },
    {
        id: "product",
        name: "Product Shot",
        icon: "\u25A1",
        color: "#14b8a6",
        prompts: "blurry, out of focus, bad lighting, harsh shadows, cluttered background, distracting elements, distorted, warped, low resolution, pixelated, watermark, text, logo, people, hands, worst quality, overexposed, underexposed, grainy",
    },
    {
        id: "food",
        name: "Food Photography",
        icon: "\u25CF",
        color: "#eab308",
        prompts: "unappetizing, blurry, out of focus, bad lighting, harsh shadows, cluttered, messy background, distorted, artificial looking, plastic, overcooked, raw, worst quality, low resolution, watermark, text, people, hands, grainy, dull colors",
    },
];

export default function Home() {
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [count, setCount] = useState(4);
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [imageSize, setImageSize] = useState("1K");
    const [loading, setLoading] = useState(false);
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [completedCount, setCompletedCount] = useState(0);

    const applyPreset = (preset: NegativePreset) => {
        if (activePreset === preset.id) {
            // Deselect
            setActivePreset(null);
            setNegativePrompt("");
        } else {
            setActivePreset(preset.id);
            setNegativePrompt(preset.prompts);
        }
    };

    const handleGenerate = useCallback(async () => {
        if (!prompt.trim() || loading) return;

        setLoading(true);
        setGallery([]);
        setCompletedCount(0);

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    negativePrompt: negativePrompt.trim(),
                    count,
                    aspectRatio,
                    imageSize,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                setGallery([
                    {
                        type: "error",
                        index: 0,
                        error: errData.error || "Failed to generate images",
                    },
                ]);
                setLoading(false);
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
                setLoading(false);
                return;
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data: ")) continue;
                    const jsonStr = trimmed.slice(6);

                    try {
                        const parsed = JSON.parse(jsonStr);

                        if (parsed.type === "image") {
                            setGallery((prev) => [...prev, parsed as GeneratedImage]);
                            setCompletedCount((prev) => prev + 1);
                        } else if (parsed.type === "error") {
                            setGallery((prev) => [...prev, parsed as GeneratedError]);
                            setCompletedCount((prev) => prev + 1);
                        }
                    } catch {
                        // ignore
                    }
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unexpected error";
            setGallery([{ type: "error", index: 0, error: message }]);
        } finally {
            setLoading(false);
        }
    }, [prompt, negativePrompt, count, aspectRatio, imageSize, loading]);

    const downloadImage = async (item: GeneratedImage, idx: number) => {
        try {
            const dataUrl = `data:${item.mimeType || "image/png"};base64,${item.data}`;
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const pngBlob = new Blob([blob], { type: "image/png" });
            const url = window.URL.createObjectURL(pngBlob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = `variation_${idx + 1}.png`;
            document.body.appendChild(a);
            a.click();
            // Small delay before cleanup to ensure download starts
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (err) {
            // Fallback: open in new tab if download fails
            const dataUrl = `data:${item.mimeType || "image/png"};base64,${item.data}`;
            window.open(dataUrl, "_blank");
        }
    };

    return (
        <>
            {/* Background orbs */}
            <div className="bg-glow" aria-hidden="true">
                <div className="bg-orb bg-orb--orange" />
                <div className="bg-orb bg-orb--teal" />
                <div className="bg-orb bg-orb--purple" />
                <div className="bg-orb bg-orb--pink" />
            </div>

            <div className="app-container">
                {/* Header */}
                <header className="app-header">
                    <div className="brand-badge">
                        <span className="brand-dot" />
                        Gemini Variations
                    </div>
                    <h1 className="app-title">
                        Generate Multiple <span className="gradient-text">Image Variations</span>
                    </h1>
                    <p className="app-subtitle">
                        Create unique AI-generated image variations from a single prompt using Google Gemini.
                    </p>
                </header>

                {/* Aspect Ratio Selector */}
                <div className="ratio-section">
                    <span className="ratio-section-label">Aspect Ratio</span>
                    <div className="ratio-grid">
                        {ASPECT_RATIOS.map((ar) => (
                            <button
                                key={ar.value}
                                className={`ratio-card${aspectRatio === ar.value ? " active" : ""}`}
                                onClick={() => setAspectRatio(ar.value)}
                                disabled={loading}
                            >
                                <div
                                    className="ratio-preview"
                                    style={{ width: ar.w, height: ar.h }}
                                />
                                <div className="ratio-label">{ar.label}</div>
                                <div className="ratio-subtitle">{ar.subtitle}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Prompt Card */}
                <div className="rainbow-card">
                    <div className="rainbow-card-inner">
                        <div className="card-header">
                            <h2 className="card-title">Create Variations</h2>
                            <div className="card-actions">
                                <button
                                    className="icon-btn"
                                    title="Clear"
                                    onClick={() => {
                                        setPrompt("");
                                        setNegativePrompt("");
                                    }}
                                >
                                    &#x2715;
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="prompt">
                                Prompt
                            </label>
                            <textarea
                                id="prompt"
                                className="prompt-textarea"
                                placeholder="Describe the image you want to generate..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Negative Prompt Presets{" "}
                                <span className="hint">(click to apply, then edit below)</span>
                            </label>
                            <div className="preset-grid">
                                {NEGATIVE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        className={`preset-chip${activePreset === preset.id ? " active" : ""}`}
                                        onClick={() => applyPreset(preset)}
                                        disabled={loading}
                                        style={
                                            activePreset === preset.id
                                                ? { borderColor: preset.color, color: preset.color, background: `${preset.color}10` }
                                                : undefined
                                        }
                                    >
                                        <span className="preset-icon" style={{ color: preset.color }}>{preset.icon}</span>
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="negativePrompt">
                                Negative Prompt{" "}
                                <span className="hint">(edit to customize further)</span>
                            </label>
                            <textarea
                                id="negativePrompt"
                                className="negative-textarea"
                                placeholder="Select a preset above or type your own negative prompts..."
                                value={negativePrompt}
                                onChange={(e) => {
                                    setNegativePrompt(e.target.value);
                                    // Clear active preset indicator if user edits away from it
                                    if (activePreset) {
                                        const preset = NEGATIVE_PRESETS.find((p) => p.id === activePreset);
                                        if (preset && e.target.value !== preset.prompts) {
                                            // Keep the preset visually but allow editing
                                        }
                                    }
                                }}
                                disabled={loading}
                            />
                        </div>

                        <div className="settings-grid">
                            <div className="form-group">
                                <label className="form-label" htmlFor="imageSize">
                                    Resolution
                                </label>
                                <select
                                    id="imageSize"
                                    className="select-input"
                                    value={imageSize}
                                    onChange={(e) => setImageSize(e.target.value)}
                                    disabled={loading}
                                >
                                    {IMAGE_SIZES.map((sz) => (
                                        <option key={sz.value} value={sz.value}>
                                            {sz.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Variations</label>
                                <div className="count-pills">
                                    {COUNTS.map((n) => (
                                        <button
                                            key={n}
                                            className={`count-pill${count === n ? " active" : ""}`}
                                            onClick={() => setCount(n)}
                                            disabled={loading}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            className="generate-btn"
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                        >
                            <span className="btn-content">
                                {loading ? (
                                    <>
                                        <span className="spinner" />
                                        Generating...
                                    </>
                                ) : (
                                    <>&#x2726; Generate Variations</>
                                )}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Progress */}
                {loading && (
                    <div className="progress-section">
                        <div className="progress-info">
                            <span className="progress-label">Generating images...</span>
                            <span className="progress-count">
                                {completedCount} / {count}
                            </span>
                        </div>
                        <div className="progress-track">
                            <div
                                className="progress-fill"
                                style={{ width: `${(completedCount / count) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Gallery */}
                {gallery.length > 0 && (
                    <div className="gallery-section">
                        <div className="gallery-header">
                            <h2 className="gallery-title">Generated Variations</h2>
                            <span className="gallery-count">
                                {gallery.filter((g) => g.type === "image").length} image
                                {gallery.filter((g) => g.type === "image").length !== 1
                                    ? "s"
                                    : ""}
                            </span>
                        </div>

                        <div className="gallery-grid">
                            {gallery.map((item, idx) => {
                                if (item.type === "error") {
                                    return (
                                        <div key={idx} className="error-card">
                                            <span className="error-icon">&#x26A0;</span>
                                            <span className="error-text">{item.error}</span>
                                        </div>
                                    );
                                }
                                return (
                                    <div
                                        key={idx}
                                        className="image-card"
                                        style={{ animationDelay: `${idx * 0.08}s` }}
                                    >
                                        <img
                                            src={`data:${item.mimeType};base64,${item.data}`}
                                            alt={`Variation ${idx + 1}`}
                                        />
                                        <div className="image-card-footer">
                                            <span className="image-card-label">
                                                Variation {idx + 1}
                                            </span>
                                            <button
                                                className="download-btn"
                                                onClick={() => downloadImage(item, idx)}
                                            >
                                                &#x2193; Save
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {loading &&
                                Array.from({
                                    length: Math.max(0, count - completedCount),
                                }).map((_, i) => (
                                    <div key={`ph-${i}`} className="placeholder-card">
                                        <div className="placeholder-inner">
                                            <div className="placeholder-icon">&#x2726;</div>
                                            <div className="placeholder-text">Generating...</div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && gallery.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">&#x2726;</div>
                        <div className="empty-title">No images yet</div>
                        <div className="empty-subtitle">
                            Enter a prompt above and click Generate to create AI image
                            variations
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
