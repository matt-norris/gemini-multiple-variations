"use client";

import { useState, useCallback, useRef, useEffect, DragEvent } from "react";

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

interface RefImage {
    id: string;
    data: string;
    mimeType: string;
    preview: string;
    name: string;
}

const ASPECT_RATIOS = [
    { label: "1:1", subtitle: "Square", value: "1:1", w: 18, h: 18 },
    { label: "16:9", subtitle: "Wide", value: "16:9", w: 24, h: 14 },
    { label: "9:16", subtitle: "Portrait", value: "9:16", w: 12, h: 22 },
    { label: "4:3", subtitle: "Classic", value: "4:3", w: 22, h: 16 },
    { label: "3:4", subtitle: "Tall", value: "3:4", w: 16, h: 22 },
    { label: "3:2", subtitle: "Photo", value: "3:2", w: 24, h: 16 },
    { label: "2:3", subtitle: "Film", value: "2:3", w: 14, h: 22 },
    { label: "5:4", subtitle: "Print", value: "5:4", w: 22, h: 18 },
    { label: "4:5", subtitle: "Social", value: "4:5", w: 16, h: 20 },
    { label: "21:9", subtitle: "Ultra", value: "21:9", w: 28, h: 12 },
];

const IMAGE_SIZES_PRO = [
    { label: "1K", value: "1K" },
    { label: "2K", value: "2K" },
    { label: "4K", value: "4K" },
];

const IMAGE_SIZES_FLASH = [{ label: "1K", value: "1K" }];

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

export default function GeneratePage() {
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [count, setCount] = useState(4);
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [imageSize, setImageSize] = useState("1K");
    const [model, setModel] = useState<"pro" | "flash">("pro");
    const [generationMode, setGenerationMode] = useState<"variations" | "same">("variations");
    const [enableSearch, setEnableSearch] = useState(false);
    const [loading, setLoading] = useState(false);
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [completedCount, setCompletedCount] = useState(0);
    const [referenceImages, setReferenceImages] = useState<RefImage[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [ratioCollapsed, setRatioCollapsed] = useState(true);
    const [lightboxItem, setLightboxItem] = useState<{ item: GeneratedImage; idx: number } | null>(null);
    const [thinkingText, setThinkingText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const maxRefImages = model === "flash" ? 3 : 14;

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setLightboxItem(null);
        };
        if (lightboxItem) {
            document.addEventListener("keydown", handleKey);
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.body.style.overflow = "";
        };
    }, [lightboxItem]);

    const applyPreset = (preset: NegativePreset) => {
        if (activePreset === preset.id) {
            setActivePreset(null);
            setNegativePrompt("");
        } else {
            setActivePreset(preset.id);
            setNegativePrompt(preset.prompts);
        }
    };

    const processFiles = useCallback(
        (files: FileList | File[]) => {
            const remaining = maxRefImages - referenceImages.length;
            const toProcess = Array.from(files).slice(0, remaining);
            toProcess.forEach((file) => {
                if (!file.type.startsWith("image/")) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target?.result as string;
                    const base64 = result.split(",")[1];
                    const newImage: RefImage = {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        data: base64,
                        mimeType: file.type,
                        preview: result,
                        name: file.name,
                    };
                    setReferenceImages((prev) => [...prev, newImage].slice(0, maxRefImages));
                };
                reader.readAsDataURL(file);
            });
        },
        [referenceImages.length, maxRefImages]
    );

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => setDragOver(false);

    const removeImage = (id: string) => {
        setReferenceImages((prev) => prev.filter((img) => img.id !== id));
    };

    const handleGenerate = useCallback(async () => {
        if (!prompt.trim() || loading) return;
        setLoading(true);
        setGallery([]);
        setCompletedCount(0);
        setThinkingText("");

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
                    model,
                    enableSearch,
                    generationMode,
                    referenceImages: referenceImages.map((img) => ({
                        data: img.data,
                        mimeType: img.mimeType,
                    })),
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                setGallery([{ type: "error", index: 0, error: errData.error || "Failed to generate images" }]);
                setLoading(false);
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) { setLoading(false); return; }

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
                            setThinkingText("");
                        } else if (parsed.type === "error") {
                            setGallery((prev) => [...prev, parsed as GeneratedError]);
                            setCompletedCount((prev) => prev + 1);
                        } else if (parsed.type === "text") {
                            setThinkingText((prev) => prev + (parsed.text || ""));
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
    }, [prompt, negativePrompt, count, aspectRatio, imageSize, model, generationMode, enableSearch, referenceImages, loading]);

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
            setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
        } catch {
            const dataUrl = `data:${item.mimeType || "image/png"};base64,${item.data}`;
            window.open(dataUrl, "_blank");
        }
    };

    const imageSizes = model === "flash" ? IMAGE_SIZES_FLASH : IMAGE_SIZES_PRO;

    return (
        <>
            <div className="page-wrapper">
                <div className="page-container">
                    <a href="/" className="page-back">&#8592; Back to Home</a>

                    <div className="page-header">
                        <h1>Single <span className="gradient-text">Prompt Studio</span></h1>
                        <p>Generate multiple AI image variations from a single prompt</p>
                    </div>

                    {/* Settings Card */}
                    <div className="glass-card">
                        <div className="model-toggle-section">
                            <span className="section-label">Model</span>
                            <div className="model-toggle">
                                <button className={`model-btn${model === "pro" ? " active" : ""}`} onClick={() => setModel("pro")} disabled={loading}>
                                    <span className="model-badge pro">PRO</span> Open Banana Pro
                                </button>
                                <button className={`model-btn${model === "flash" ? " active" : ""}`} onClick={() => { setModel("flash"); setImageSize("1K"); setEnableSearch(false); if (referenceImages.length > 3) setReferenceImages((p) => p.slice(0, 3)); }} disabled={loading}>
                                    <span className="model-badge flash">FLASH</span> Open Banana Flash
                                </button>
                            </div>
                            <div className="model-info">
                                {model === "pro" ? "Up to 14 reference images · 4K resolution · Search grounding · Advanced reasoning" : "Up to 3 reference images · 1K resolution · Faster generation"}
                            </div>
                        </div>

                        <div className="model-toggle-section">
                            <span className="section-label">Generation Mode</span>
                            <div className="model-toggle">
                                <button className={`model-btn${generationMode === "variations" ? " active" : ""}`} onClick={() => setGenerationMode("variations")} disabled={loading}>Multiple Variations</button>
                                <button className={`model-btn${generationMode === "same" ? " active" : ""}`} onClick={() => setGenerationMode("same")} disabled={loading}>Same Prompt</button>
                            </div>
                            <div className="model-info">
                                {generationMode === "variations" ? "Each image gets a unique variation instruction for diverse results" : "All images use the exact same prompt for consistent results"}
                            </div>
                        </div>

                        <div className="ratio-section">
                            <button className="ratio-section-toggle" onClick={() => setRatioCollapsed(!ratioCollapsed)} type="button">
                                <span className="ratio-toggle-left">
                                    <span className="ratio-toggle-label">Aspect Ratio</span>
                                    <span className="ratio-toggle-value">
                                        {ASPECT_RATIOS.find((ar) => ar.value === aspectRatio)?.label || aspectRatio}{" · "}{ASPECT_RATIOS.find((ar) => ar.value === aspectRatio)?.subtitle || ""}
                                    </span>
                                </span>
                                <span className={`ratio-chevron${!ratioCollapsed ? " open" : ""}`}>&#x25BE;</span>
                            </button>
                            {!ratioCollapsed && (
                                <div className="ratio-grid">
                                    {ASPECT_RATIOS.map((ar) => (
                                        <button key={ar.value} className={`ratio-option${aspectRatio === ar.value ? " active" : ""}`} onClick={() => setAspectRatio(ar.value)} disabled={loading}>
                                            <div className="ratio-shape" style={{ width: ar.w, height: ar.h }} />
                                            <span className="ratio-label-text">{ar.label}</span>
                                            <span className="ratio-label-sub">{ar.subtitle}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prompt Card */}
                    <div className="glass-card">
                        <div className="glass-card-header">
                            <span className="glass-card-title">Create Variations</span>
                            <button className="icon-btn" title="Clear all" onClick={() => { setPrompt(""); setNegativePrompt(""); setActivePreset(null); setReferenceImages([]); }}>&#x2715;</button>
                        </div>

                        {/* Reference Images */}
                        <div className="form-group">
                            <label>Reference Images <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(up to {maxRefImages} {model === "pro" ? "— 6 objects + 5 people" : "images"})</span></label>
                            <div className={`upload-zone${dragOver ? " drag-over" : ""}${referenceImages.length > 0 ? " has-images" : ""}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()}>
                                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
                                {referenceImages.length === 0 ? (
                                    <div className="upload-placeholder">
                                        <div className="upload-icon">&#x2912;</div>
                                        <div className="upload-text">Drag &amp; drop images or <span>click to browse</span></div>
                                        <div className="upload-hint">PNG, JPG, WEBP supported</div>
                                    </div>
                                ) : (
                                    <div className="upload-thumbnails" onClick={(e) => e.stopPropagation()}>
                                        {referenceImages.map((img) => (
                                            <div key={img.id} className="upload-thumb">
                                                <img src={img.preview} alt={img.name} />
                                                <button className="upload-thumb-remove" onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} title="Remove">&#x2715;</button>
                                            </div>
                                        ))}
                                        {referenceImages.length < maxRefImages && (
                                            <button className="icon-btn" style={{ width: 72, height: 72 }} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>+</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="prompt">Prompt</label>
                            <textarea id="prompt" placeholder="Describe the image you want to generate..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={loading} />
                        </div>

                        <div className="form-group">
                            <label>Negative Prompt Presets</label>
                            <div className="presets-grid">
                                {NEGATIVE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        className={`preset-chip${activePreset === preset.id ? " active" : ""}`}
                                        onClick={() => applyPreset(preset)}
                                        disabled={loading}
                                        style={activePreset === preset.id ? { borderColor: preset.color, color: preset.color, background: `${preset.color}10` } : undefined}
                                    >
                                        <span className="preset-chip-icon" style={{ color: preset.color }}>{preset.icon}</span>
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="negativePrompt">Negative Prompt</label>
                            <textarea id="negativePrompt" placeholder="Select a preset above or type your own..." value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} disabled={loading} style={{ minHeight: 80 }} />
                        </div>

                        <div className="settings-grid">
                            <div className="form-group">
                                <label htmlFor="imageSize">Resolution</label>
                                <select id="imageSize" value={imageSize} onChange={(e) => setImageSize(e.target.value)} disabled={loading}>
                                    {imageSizes.map((sz) => (<option key={sz.value} value={sz.value}>{sz.label}</option>))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Variations</label>
                                <div className="pill-group">
                                    {COUNTS.map((n) => (
                                        <button key={n} className={`pill-btn${count === n ? " active" : ""}`} onClick={() => setCount(n)} disabled={loading}>{n}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {model === "pro" && (
                            <div className="toggle-row">
                                <span className="toggle-label">Google Search Grounding</span>
                                <div className={`toggle-switch${enableSearch ? " active" : ""}`} onClick={() => setEnableSearch(!enableSearch)} role="switch" aria-checked={enableSearch} />
                            </div>
                        )}

                        <div className="generate-section">
                            <button className={`generate-btn${loading ? " loading" : ""}`} onClick={handleGenerate} disabled={loading || !prompt.trim()}>
                                {loading ? "Generating..." : "✦ Generate Variations"}
                            </button>
                        </div>
                    </div>

                    {/* Progress */}
                    {loading && (
                        <div className="progress-section">
                            <div className="progress-text">Generating... {completedCount} / {count}</div>
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill" style={{ width: `${(completedCount / count) * 100}%` }} />
                            </div>
                        </div>
                    )}

                    {/* AI Thinking */}
                    {thinkingText && (
                        <div className="thinking-section">
                            <div className="thinking-header">
                                <span className="thinking-icon">&#x2728;</span>
                                <span className="thinking-label">AI Thinking</span>
                                {loading && <span className="thinking-pulse" />}
                            </div>
                            <div className="thinking-text">
                                {thinkingText}
                                {loading && <span className="thinking-cursor">|</span>}
                            </div>
                        </div>
                    )}

                    {/* Gallery */}
                    {gallery.length > 0 && (
                        <div className="gallery-section">
                            <div className="gallery-header">
                                <h2 className="gallery-title">Generated Variations</h2>
                                <span className="gallery-count">{gallery.filter((g) => g.type === "image").length} image{gallery.filter((g) => g.type === "image").length !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="gallery-grid">
                                {gallery.map((item, idx) => {
                                    if (item.type === "error") {
                                        return (<div key={idx} className="error-card"><span className="error-icon">&#x26A0;</span><span className="error-text">{item.error}</span></div>);
                                    }
                                    return (
                                        <div key={idx} className="image-card" style={{ animationDelay: `${idx * 0.08}s` }}>
                                            <img src={`data:${item.mimeType};base64,${item.data}`} alt={`Variation ${idx + 1}`} />
                                            <div className="image-card-footer">
                                                <span className="image-card-label">Variation {idx + 1}</span>
                                                <div className="image-card-actions">
                                                    <button className="icon-btn" onClick={() => setLightboxItem({ item, idx })} title="View">⇱</button>
                                                    <button className="icon-btn" onClick={() => downloadImage(item, idx)} title="Download">↓</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {lightboxItem && (
                <div className="lightbox-overlay" onClick={() => setLightboxItem(null)}>
                    <button className="lightbox-close" onClick={() => setLightboxItem(null)}>&#x2715;</button>
                    <img src={`data:${lightboxItem.item.mimeType};base64,${lightboxItem.item.data}`} alt={`Variation ${lightboxItem.idx + 1}`} className="lightbox-image" onClick={(e) => e.stopPropagation()} />
                    <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => downloadImage(lightboxItem.item, lightboxItem.idx)}>↓ Download PNG</button>
                    </div>
                </div>
            )}
        </>
    );
}
