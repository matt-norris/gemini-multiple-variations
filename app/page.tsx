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

export default function Home() {
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [count, setCount] = useState(4);
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [imageSize, setImageSize] = useState("1K");
    const [loading, setLoading] = useState(false);
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [completedCount, setCompletedCount] = useState(0);

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

    const downloadImage = (item: GeneratedImage, idx: number) => {
        const ext = item.mimeType?.split("/")[1] || "png";
        const link = document.createElement("a");
        link.href = `data:${item.mimeType};base64,${item.data}`;
        link.download = `variation_${idx + 1}.${ext}`;
        link.click();
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
                            <label className="form-label" htmlFor="negativePrompt">
                                Negative Prompt{" "}
                                <span className="hint">(things to avoid)</span>
                            </label>
                            <input
                                id="negativePrompt"
                                className="text-input"
                                type="text"
                                placeholder="e.g. blurry, distorted, watermark, low quality..."
                                value={negativePrompt}
                                onChange={(e) => setNegativePrompt(e.target.value)}
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
