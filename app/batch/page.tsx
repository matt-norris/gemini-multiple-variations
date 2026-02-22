"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import JSZip from "jszip";

interface BatchImage {
    type: "image";
    index: number;
    prompt: string;
    mimeType: string;
    data: string;
}

interface BatchError {
    type: "error";
    index: number;
    prompt: string;
    error: string;
}

type BatchResult = BatchImage | BatchError;

interface ParsedPrompt {
    title: string;
    body: string;
}

const ASPECT_RATIOS = [
    { label: "1:1", value: "1:1", tag: "Square", w: 14, h: 14 },
    { label: "16:9", value: "16:9", tag: "Wide", w: 18, h: 10 },
    { label: "9:16", value: "9:16", tag: "Portrait", w: 10, h: 18 },
    { label: "4:3", value: "4:3", tag: "Classic", w: 16, h: 12 },
    { label: "3:4", value: "3:4", tag: "Tall", w: 12, h: 16 },
    { label: "3:2", value: "3:2", tag: "Photo", w: 18, h: 12 },
    { label: "2:3", value: "2:3", tag: "Film", w: 12, h: 18 },
    { label: "21:9", value: "21:9", tag: "Ultra", w: 21, h: 9 },
];

/**
 * Parses numbered prompt format:
 * 1. Title Line
 * Description paragraph...
 *
 * 2. Another Title
 * Another description...
 *
 * Also detects "Shared Negative Prompt" section.
 */
function parseNumberedPrompts(text: string): {
    prompts: ParsedPrompt[];
    negativePrompt: string;
} {
    const lines = text.split("\n");
    const prompts: ParsedPrompt[] = [];
    let negativePrompt = "";
    let currentTitle = "";
    let currentBodyLines: string[] = [];
    let inNegative = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check for negative prompt section
        if (/^(shared\s+)?negative\s+prompt/i.test(trimmed)) {
            // Save any current prompt
            if (currentTitle) {
                prompts.push({
                    title: currentTitle,
                    body: currentBodyLines.join("\n").trim(),
                });
                currentTitle = "";
                currentBodyLines = [];
            }
            inNegative = true;
            continue;
        }

        if (inNegative) {
            if (trimmed) {
                negativePrompt += (negativePrompt ? " " : "") + trimmed;
            }
            continue;
        }

        // Check for numbered heading: "1. Title" or "1) Title"
        const numberedMatch = trimmed.match(/^\d+[\.\)]\s+(.+)/);
        if (numberedMatch) {
            // Save previous prompt
            if (currentTitle) {
                prompts.push({
                    title: currentTitle,
                    body: currentBodyLines.join("\n").trim(),
                });
            }
            currentTitle = numberedMatch[1];
            currentBodyLines = [];
        } else if (currentTitle && trimmed) {
            currentBodyLines.push(trimmed);
        }
    }

    // Save last prompt
    if (currentTitle) {
        prompts.push({
            title: currentTitle,
            body: currentBodyLines.join("\n").trim(),
        });
    }

    return { prompts, negativePrompt };
}

export default function BatchPage() {
    const [parsedPrompts, setParsedPrompts] = useState<ParsedPrompt[]>([]);
    const [negativePrompt, setNegativePrompt] = useState("");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [imageSize, setImageSize] = useState("1K");
    const [model, setModel] = useState<"pro" | "flash">("pro");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<BatchResult[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [completedCount, setCompletedCount] = useState(0);
    const [fileName, setFileName] = useState("");
    const [rawText, setRawText] = useState("");
    const [lightboxItem, setLightboxItem] = useState<{
        item: BatchImage;
        idx: number;
    } | null>(null);
    const [ratioOpen, setRatioOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ratioDropdownRef = useRef<HTMLDivElement>(null);

    // Close ratio dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                ratioDropdownRef.current &&
                !ratioDropdownRef.current.contains(e.target as Node)
            ) {
                setRatioOpen(false);
            }
        };
        if (ratioOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ratioOpen]);

    const selectedRatio = ASPECT_RATIOS.find((r) => r.value === aspectRatio) || ASPECT_RATIOS[0];

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

    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setRawText(text);
            setFileName(file.name);
            const { prompts, negativePrompt: parsedNeg } =
                parseNumberedPrompts(text);
            setParsedPrompts(prompts);
            if (parsedNeg) {
                setNegativePrompt(parsedNeg);
            }
        };
        reader.readAsText(file);
    };

    const handleManualParse = () => {
        const { prompts, negativePrompt: parsedNeg } =
            parseNumberedPrompts(rawText);
        setParsedPrompts(prompts);
        if (parsedNeg) {
            setNegativePrompt(parsedNeg);
        }
    };

    const removePrompt = (idx: number) => {
        setParsedPrompts((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleGenerate = useCallback(async () => {
        if (parsedPrompts.length === 0 || loading) return;

        setLoading(true);
        setResults([]);
        setTotalCount(parsedPrompts.length);
        setCompletedCount(0);

        // Combine title + body for each prompt
        const fullPrompts = parsedPrompts.map((p) =>
            p.body ? `${p.title}\n${p.body}` : p.title
        );

        try {
            const res = await fetch("/api/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompts: fullPrompts,
                    negativePrompt: negativePrompt.trim(),
                    aspectRatio,
                    imageSize,
                    model,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                setResults([
                    {
                        type: "error",
                        index: 0,
                        prompt: "",
                        error: errData.error || "Failed to generate",
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
                            setResults((prev) => [...prev, parsed as BatchImage]);
                            setCompletedCount((prev) => prev + 1);
                        } else if (parsed.type === "error") {
                            setResults((prev) => [...prev, parsed as BatchError]);
                            setCompletedCount((prev) => prev + 1);
                        } else if (parsed.type === "total") {
                            setTotalCount(parsed.count);
                        }
                    } catch {
                        // skip
                    }
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unexpected error";
            setResults([
                { type: "error", index: 0, prompt: "", error: message },
            ]);
        } finally {
            setLoading(false);
        }
    }, [parsedPrompts, negativePrompt, aspectRatio, imageSize, model, loading]);

    const downloadZip = async () => {
        const images = results.filter(
            (r): r is BatchImage => r.type === "image"
        );
        if (images.length === 0) return;

        const zip = new JSZip();
        images.forEach((img, i) => {
            const byteCharacters = atob(img.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) {
                byteNumbers[j] = byteCharacters.charCodeAt(j);
            }
            const byteArray = new Uint8Array(byteNumbers);

            const safeName =
                (parsedPrompts[img.index]?.title || img.prompt)
                    .replace(/[^a-zA-Z0-9 ]/g, "")
                    .replace(/\s+/g, "_")
                    .slice(0, 50) || `image_${i + 1}`;
            zip.file(
                `${String(i + 1).padStart(2, "0")}_${safeName}.png`,
                byteArray
            );
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch_images_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    };

    const downloadSingle = async (img: BatchImage, idx: number) => {
        try {
            const dataUrl = `data:${img.mimeType || "image/png"};base64,${img.data}`;
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const pngBlob = new Blob([blob], { type: "image/png" });
            const url = window.URL.createObjectURL(pngBlob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            const safeName =
                (parsedPrompts[img.index]?.title || img.prompt)
                    .replace(/[^a-zA-Z0-9 ]/g, "")
                    .replace(/\s+/g, "_")
                    .slice(0, 50) || `image_${idx + 1}`;
            a.download = `${String(idx + 1).padStart(2, "0")}_${safeName}.png`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch {
            // fallback
        }
    };

    const imageCount = results.filter((r) => r.type === "image").length;
    const isDone = !loading && results.length > 0;

    return (
        <>
            <div className="bg-glow" aria-hidden="true">
                <div className="bg-orb bg-orb--orange" />
                <div className="bg-orb bg-orb--teal" />
                <div className="bg-orb bg-orb--purple" />
                <div className="bg-orb bg-orb--pink" />
            </div>

            <div className="app-container">
                <header className="app-header">
                    <div className="brand-badge">
                        <span className="brand-dot" />
                        Gemini Variations
                    </div>
                    <h1 className="app-title">
                        Multi-Prompt{" "}
                        <span className="gradient-text">Batch Generator</span>
                    </h1>
                    <p className="app-subtitle">
                        Upload a .txt file with numbered prompts — one image per prompt,
                        then download all as a ZIP.
                    </p>
                    <a href="/" className="back-link">
                        &#x2190; Back to Single Prompt
                    </a>
                </header>

                {/* Upload & Input Card */}
                <div className="rainbow-card">
                    <div className="rainbow-card-inner">
                        <div className="card-header">
                            <h2 className="card-title">Prompt List</h2>
                            <span className="batch-count-badge">
                                {parsedPrompts.length} prompt
                                {parsedPrompts.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                        {/* File Upload */}
                        <div className="form-group">
                            <label className="form-label">
                                Upload Prompt File{" "}
                                <span className="hint">(.txt with numbered prompts)</span>
                            </label>
                            <div
                                className="file-upload-zone"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.text"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file);
                                        e.target.value = "";
                                    }}
                                    style={{ display: "none" }}
                                />
                                {fileName ? (
                                    <div className="file-upload-loaded">
                                        <span className="file-icon">&#x1F4C4;</span>
                                        <span className="file-name">{fileName}</span>
                                        <span className="file-status">
                                            &#x2713; {parsedPrompts.length} prompts parsed
                                        </span>
                                    </div>
                                ) : (
                                    <div className="file-upload-empty">
                                        <span className="file-icon">&#x1F4C2;</span>
                                        <span>Click to upload a .txt file</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Or paste manually */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="batchPrompts">
                                Or Paste Prompts{" "}
                                <span className="hint">(numbered format: 1. Title followed by description)</span>
                            </label>
                            <textarea
                                id="batchPrompts"
                                className="prompt-textarea batch-textarea"
                                placeholder={`1. Golden Hour Mountain Lake\nA breathtaking ultra-realistic photograph of a serene mountain lake at golden hour, reflections on still water...\n\n2. Neon-Lit Tokyo Alley\nA cinematic photo of a narrow Tokyo alley at night, glowing neon signs, wet pavement reflections...\n\n3. Abstract Fluid Art\nA vibrant abstract fluid art composition with swirling metallic gold, deep blue, and coral pigments...\n\nShared Negative Prompt\nblurry, low quality, watermark, text...`}
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                disabled={loading}
                            />
                            {rawText && (
                                <button
                                    className="parse-btn"
                                    onClick={handleManualParse}
                                    disabled={loading}
                                >
                                    &#x2726; Parse Prompts
                                </button>
                            )}
                        </div>

                        {/* Parsed Prompts Preview */}
                        {parsedPrompts.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">
                                    Parsed Prompts{" "}
                                    <span className="hint">(click ✕ to remove)</span>
                                </label>
                                <div className="parsed-list">
                                    {parsedPrompts.map((p, idx) => (
                                        <div key={idx} className="parsed-item">
                                            <span className="parsed-num">{idx + 1}</span>
                                            <div className="parsed-info">
                                                <div className="parsed-title">{p.title}</div>
                                                {p.body && (
                                                    <div className="parsed-body">
                                                        {p.body.slice(0, 120)}
                                                        {p.body.length > 120 ? "..." : ""}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                className="parsed-remove"
                                                onClick={() => removePrompt(idx)}
                                                disabled={loading}
                                            >
                                                &#x2715;
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Shared Negative Prompt */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="batchNegative">
                                Shared Negative Prompt{" "}
                                <span className="hint">(applied to every image)</span>
                            </label>
                            <textarea
                                id="batchNegative"
                                className="negative-textarea"
                                placeholder="Negative prompts that apply to all generated images..."
                                value={negativePrompt}
                                onChange={(e) => setNegativePrompt(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        {/* Settings */}
                        <div className="settings-grid settings-grid-3">
                            <div className="form-group">
                                <label className="form-label">Model</label>
                                <select
                                    className="select-input"
                                    value={model}
                                    onChange={(e) =>
                                        setModel(e.target.value as "pro" | "flash")
                                    }
                                    disabled={loading}
                                >
                                    <option value="pro">Nano Banana Pro</option>
                                    <option value="flash">Nano Banana Flash</option>
                                </select>
                            </div>
                            <div className="form-group" ref={ratioDropdownRef}>
                                <label className="form-label">Aspect Ratio</label>
                                <button
                                    type="button"
                                    className="ratio-trigger"
                                    onClick={() => !loading && setRatioOpen(!ratioOpen)}
                                    disabled={loading}
                                >
                                    <span
                                        className="ratio-mini-shape"
                                        style={{
                                            width: selectedRatio.w,
                                            height: selectedRatio.h,
                                        }}
                                    />
                                    <span className="ratio-trigger-label">{selectedRatio.label}</span>
                                    <span className="ratio-trigger-tag">{selectedRatio.tag}</span>
                                    <span className={`ratio-chevron${ratioOpen ? " open" : ""}`}>&#x25BE;</span>
                                </button>
                                {ratioOpen && (
                                    <div className="ratio-dropdown">
                                        {ASPECT_RATIOS.map((ar) => (
                                            <button
                                                key={ar.value}
                                                type="button"
                                                className={`ratio-option${ar.value === aspectRatio ? " active" : ""}`}
                                                onClick={() => {
                                                    setAspectRatio(ar.value);
                                                    setRatioOpen(false);
                                                }}
                                            >
                                                <span
                                                    className="ratio-mini-shape"
                                                    style={{ width: ar.w, height: ar.h }}
                                                />
                                                <span className="ratio-option-label">{ar.label}</span>
                                                <span className="ratio-option-tag">{ar.tag}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Resolution</label>
                                <select
                                    className="select-input"
                                    value={imageSize}
                                    onChange={(e) => setImageSize(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="1K">1K</option>
                                    {model === "pro" && <option value="2K">2K</option>}
                                    {model === "pro" && <option value="4K">4K</option>}
                                </select>
                            </div>
                        </div>

                        <button
                            className="generate-btn"
                            onClick={handleGenerate}
                            disabled={loading || parsedPrompts.length === 0}
                        >
                            <span className="btn-content">
                                {loading ? (
                                    <>
                                        <span className="spinner" />
                                        Generating {completedCount}/{totalCount}...
                                    </>
                                ) : (
                                    <>
                                        &#x2726; Generate {parsedPrompts.length} Image
                                        {parsedPrompts.length !== 1 ? "s" : ""}
                                    </>
                                )}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Progress */}
                {loading && totalCount > 0 && (
                    <div className="progress-section">
                        <div className="progress-info">
                            <span className="progress-label">
                                Generating image {completedCount + 1} of {totalCount}
                                {parsedPrompts[completedCount] &&
                                    ` — ${parsedPrompts[completedCount].title.slice(0, 40)}...`}
                            </span>
                            <span className="progress-count">
                                {completedCount} / {totalCount}
                            </span>
                        </div>
                        <div className="progress-track">
                            <div
                                className="progress-fill"
                                style={{
                                    width: `${(completedCount / totalCount) * 100}%`,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Results */}
                {results.length > 0 && (
                    <div className="gallery-section">
                        <div className="gallery-header">
                            <h2 className="gallery-title">Results</h2>
                            <div className="gallery-header-actions">
                                <span className="gallery-count">
                                    {imageCount} image{imageCount !== 1 ? "s" : ""}
                                </span>
                                {isDone && imageCount > 0 && (
                                    <button className="zip-btn" onClick={downloadZip}>
                                        &#x1F4E6; Download ZIP
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="batch-results">
                            {results.map((item, idx) => {
                                if (item.type === "error") {
                                    return (
                                        <div key={idx} className="batch-result-row error-row">
                                            <div className="batch-result-index">{idx + 1}</div>
                                            <div className="batch-result-info">
                                                <div className="batch-result-prompt">
                                                    {parsedPrompts[item.index]?.title || item.prompt}
                                                </div>
                                                <div className="batch-result-error">
                                                    &#x26A0; {item.error}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={idx} className="batch-result-row">
                                        <div className="batch-result-index">{idx + 1}</div>
                                        <div
                                            className="batch-result-thumb"
                                            onClick={() => setLightboxItem({ item, idx })}
                                        >
                                            <img
                                                src={`data:${item.mimeType};base64,${item.data}`}
                                                alt={parsedPrompts[item.index]?.title || item.prompt}
                                            />
                                        </div>
                                        <div className="batch-result-info">
                                            <div className="batch-result-prompt">
                                                {parsedPrompts[item.index]?.title || item.prompt}
                                            </div>
                                            <div className="batch-result-actions">
                                                <button
                                                    className="download-btn"
                                                    onClick={() => setLightboxItem({ item, idx })}
                                                >
                                                    &#x26F6; View
                                                </button>
                                                <button
                                                    className="download-btn"
                                                    onClick={() => downloadSingle(item, idx)}
                                                >
                                                    &#x2193; Save
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && results.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">&#x1F4C4;</div>
                        <div className="empty-title">
                            Upload a .txt file or paste your prompts above
                        </div>
                        <div className="empty-subtitle">
                            Numbered format (1. Title + description) — one image per prompt
                        </div>
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxItem && (
                <div
                    className="lightbox-overlay"
                    onClick={() => setLightboxItem(null)}
                >
                    <div
                        className="lightbox-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={`data:${lightboxItem.item.mimeType};base64,${lightboxItem.item.data}`}
                            alt={
                                parsedPrompts[lightboxItem.item.index]?.title ||
                                lightboxItem.item.prompt
                            }
                            className="lightbox-img"
                        />
                        <div className="lightbox-toolbar">
                            <span className="lightbox-label">
                                {(
                                    parsedPrompts[lightboxItem.item.index]?.title ||
                                    lightboxItem.item.prompt
                                ).slice(0, 50)}
                            </span>
                            <div className="lightbox-actions">
                                <button
                                    className="lightbox-btn"
                                    onClick={() =>
                                        downloadSingle(lightboxItem.item, lightboxItem.idx)
                                    }
                                >
                                    &#x2193; Download
                                </button>
                                <button
                                    className="lightbox-btn lightbox-close"
                                    onClick={() => setLightboxItem(null)}
                                >
                                    &#x2715; Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
