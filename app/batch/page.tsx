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

function parseNumberedPrompts(text: string): { prompts: ParsedPrompt[]; negativePrompt: string } {
    const lines = text.split("\n");
    const prompts: ParsedPrompt[] = [];
    let negativePrompt = "";
    let currentTitle = "";
    let currentBodyLines: string[] = [];
    let inNegative = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/^(shared\s+)?negative\s+prompt/i.test(trimmed)) {
            if (currentTitle) {
                prompts.push({ title: currentTitle, body: currentBodyLines.join("\n").trim() });
                currentTitle = "";
                currentBodyLines = [];
            }
            inNegative = true;
            continue;
        }

        if (inNegative) {
            if (trimmed) negativePrompt += (negativePrompt ? " " : "") + trimmed;
            continue;
        }

        const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
        if (numberedMatch) {
            if (currentTitle) {
                prompts.push({ title: currentTitle, body: currentBodyLines.join("\n").trim() });
            }
            currentTitle = numberedMatch[1];
            currentBodyLines = [];
        } else if (currentTitle && trimmed) {
            currentBodyLines.push(trimmed);
        }
    }

    if (currentTitle) {
        prompts.push({ title: currentTitle, body: currentBodyLines.join("\n").trim() });
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
    const [lightboxItem, setLightboxItem] = useState<{ item: BatchImage; idx: number } | null>(null);
    const [ratioOpen, setRatioOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ratioDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ratioDropdownRef.current && !ratioDropdownRef.current.contains(e.target as Node)) setRatioOpen(false);
        };
        if (ratioOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ratioOpen]);

    const selectedRatio = ASPECT_RATIOS.find((r) => r.value === aspectRatio) || ASPECT_RATIOS[0];

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxItem(null); };
        if (lightboxItem) { document.addEventListener("keydown", handleKey); document.body.style.overflow = "hidden"; }
        else { document.body.style.overflow = ""; }
        return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
    }, [lightboxItem]);

    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setRawText(text);
            setFileName(file.name);
            const { prompts, negativePrompt: parsedNeg } = parseNumberedPrompts(text);
            setParsedPrompts(prompts);
            if (parsedNeg) setNegativePrompt(parsedNeg);
        };
        reader.readAsText(file);
    };

    const handleManualParse = () => {
        const { prompts, negativePrompt: parsedNeg } = parseNumberedPrompts(rawText);
        setParsedPrompts(prompts);
        if (parsedNeg) setNegativePrompt(parsedNeg);
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

        const fullPrompts = parsedPrompts.map((p) => (p.body ? `${p.title}\n${p.body}` : p.title));

        try {
            const res = await fetch("/api/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompts: fullPrompts, negativePrompt: negativePrompt.trim(), aspectRatio, imageSize, model }),
            });

            if (!res.ok) {
                const errData = await res.json();
                setResults([{ type: "error", index: 0, prompt: "", error: errData.error || "Failed to generate" }]);
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
                            setResults((prev) => [...prev, parsed as BatchImage]);
                            setCompletedCount((prev) => prev + 1);
                        } else if (parsed.type === "error") {
                            setResults((prev) => [...prev, parsed as BatchError]);
                            setCompletedCount((prev) => prev + 1);
                        } else if (parsed.type === "total") {
                            setTotalCount(parsed.count);
                        }
                    } catch (parseErr) {
                        console.warn("SSE parse error:", parseErr, "raw:", jsonStr);
                    }
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unexpected error";
            setResults([{ type: "error", index: 0, prompt: "", error: message }]);
        } finally {
            setLoading(false);
        }
    }, [parsedPrompts, negativePrompt, aspectRatio, imageSize, model, loading]);

    const downloadZip = async () => {
        const images = results.filter((r): r is BatchImage => r.type === "image");
        if (images.length === 0) return;
        const zip = new JSZip();
        images.forEach((img, i) => {
            const byteCharacters = atob(img.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) byteNumbers[j] = byteCharacters.charCodeAt(j);
            const byteArray = new Uint8Array(byteNumbers);
            const safeName = (parsedPrompts[img.index]?.title || img.prompt).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").slice(0, 50) || `image_${i + 1}`;
            zip.file(`${String(i + 1).padStart(2, "0")}_${safeName}.png`, byteArray);
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch_images_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
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
            const safeName = (parsedPrompts[img.index]?.title || img.prompt).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").slice(0, 50) || `image_${idx + 1}`;
            a.download = `${String(idx + 1).padStart(2, "0")}_${safeName}.png`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
        } catch { /* fallback */ }
    };

    const imageCount = results.filter((r) => r.type === "image").length;
    const isDone = !loading && results.length > 0;

    return (
        <>
            <div className="page-wrapper">
                <div className="page-container">
                    <a href="/" className="page-back">&#8592; Back to Home</a>

                    <div className="page-header">
                        <h1>Multi-Prompt <span className="gradient-text">Batch Generator</span></h1>
                        <p>Upload a .txt file with numbered prompts — one image per prompt, then download all as a ZIP.</p>
                    </div>

                    {/* Input Card */}
                    <div className="glass-card">
                        <div className="glass-card-header">
                            <span className="glass-card-title">Prompt List</span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {parsedPrompts.length} prompt{parsedPrompts.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                        {/* File Upload */}
                        <div className="form-group">
                            <label>Upload Prompt File <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(.txt with numbered prompts)</span></label>
                            <div className="file-upload-zone" onClick={() => fileInputRef.current?.click()}>
                                <input ref={fileInputRef} type="file" accept=".txt,.text" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); e.target.value = ""; }} style={{ display: "none" }} />
                                {fileName ? (
                                    <div className="file-upload-loaded">
                                        <span>📄</span>
                                        <span>{fileName}</span>
                                        <span style={{ color: "var(--accent-green)" }}>✓ {parsedPrompts.length} prompts parsed</span>
                                    </div>
                                ) : (
                                    <div className="file-upload-empty">
                                        <span>📂</span>
                                        <span>Click to upload a .txt file</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Or paste manually */}
                        <div className="form-group">
                            <label htmlFor="batchPrompts">Or Paste Prompts</label>
                            <textarea
                                id="batchPrompts"
                                className="batch-textarea"
                                placeholder={`1. Golden Hour Mountain Lake\nA breathtaking ultra-realistic photograph of a serene mountain lake at golden hour...\n\n2. Neon-Lit Tokyo Alley\nA cinematic photo of a narrow Tokyo alley at night...\n\nShared Negative Prompt\nblurry, low quality, watermark, text...`}
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                disabled={loading}
                            />
                            {rawText && (
                                <button className="generate-btn" style={{ marginTop: 12, background: "var(--bg-glass-strong)", fontSize: 13 }} onClick={handleManualParse} disabled={loading}>
                                    ✦ Parse Prompts
                                </button>
                            )}
                        </div>

                        {/* Parsed Prompts Preview */}
                        {parsedPrompts.length > 0 && (
                            <div className="form-group">
                                <label>Parsed Prompts</label>
                                <div className="prompt-preview-list">
                                    {parsedPrompts.map((p, idx) => (
                                        <div key={idx} className="prompt-preview-item" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                            <div style={{ flex: 1 }}>
                                                <div className="prompt-preview-num">Prompt {idx + 1}</div>
                                                <div className="prompt-preview-title">{p.title}</div>
                                                {p.body && <div className="prompt-preview-body">{p.body.slice(0, 120)}{p.body.length > 120 ? "..." : ""}</div>}
                                            </div>
                                            <button className="icon-btn" onClick={() => removePrompt(idx)} disabled={loading} title="Remove">&#x2715;</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Negative Prompt */}
                        <div className="form-group">
                            <label htmlFor="batchNegative">Shared Negative Prompt</label>
                            <textarea id="batchNegative" placeholder="Negative prompts that apply to all generated images..." value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} disabled={loading} style={{ minHeight: 80 }} />
                        </div>

                        {/* Settings */}
                        <div className="settings-grid-3">
                            <div className="form-group">
                                <label>Model</label>
                                <select value={model} onChange={(e) => setModel(e.target.value as "pro" | "flash")} disabled={loading}>
                                    <option value="pro">Nano Banana Pro</option>
                                    <option value="flash">Nano Banana Flash</option>
                                </select>
                            </div>
                            <div className="form-group" ref={ratioDropdownRef}>
                                <label>Aspect Ratio</label>
                                <button type="button" className="ratio-trigger" onClick={() => !loading && setRatioOpen(!ratioOpen)} disabled={loading}>
                                    <span className="ratio-mini-shape" style={{ width: selectedRatio.w, height: selectedRatio.h }} />
                                    <span className="ratio-trigger-label">{selectedRatio.label}</span>
                                    <span className="ratio-trigger-tag">{selectedRatio.tag}</span>
                                    <span className={`ratio-trigger-chevron${ratioOpen ? " open" : ""}`}>&#x25BE;</span>
                                </button>
                                {ratioOpen && (
                                    <div className="ratio-dropdown">
                                        {ASPECT_RATIOS.map((ar) => (
                                            <button key={ar.value} type="button" className={`ratio-dropdown-item${ar.value === aspectRatio ? " active" : ""}`} onClick={() => { setAspectRatio(ar.value); setRatioOpen(false); }}>
                                                <span className="ratio-mini-shape" style={{ width: ar.w, height: ar.h }} />
                                                <span className="ratio-dropdown-label">{ar.label}</span>
                                                <span className="ratio-dropdown-tag">{ar.tag}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Resolution</label>
                                <select value={imageSize} onChange={(e) => setImageSize(e.target.value)} disabled={loading}>
                                    <option value="1K">1K</option>
                                    {model === "pro" && <option value="2K">2K</option>}
                                    {model === "pro" && <option value="4K">4K</option>}
                                </select>
                            </div>
                        </div>

                        <div className="generate-section">
                            <button className={`generate-btn${loading ? " loading" : ""}`} onClick={handleGenerate} disabled={loading || parsedPrompts.length === 0}>
                                {loading ? `Generating ${completedCount}/${totalCount}...` : `✦ Generate ${parsedPrompts.length} Image${parsedPrompts.length !== 1 ? "s" : ""}`}
                            </button>
                        </div>
                    </div>

                    {/* Progress */}
                    {loading && totalCount > 0 && (
                        <div className="progress-section">
                            <div className="progress-text">
                                Generating image {completedCount + 1} of {totalCount}
                                {parsedPrompts[completedCount] && ` — ${parsedPrompts[completedCount].title.slice(0, 40)}...`}
                            </div>
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill" style={{ width: `${(completedCount / totalCount) * 100}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="gallery-section">
                            <div className="gallery-header">
                                <h2 className="gallery-title">Results</h2>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span className="gallery-count">{imageCount} image{imageCount !== 1 ? "s" : ""}</span>
                                    {isDone && imageCount > 0 && (
                                        <button className="download-zip-btn" onClick={downloadZip}>📦 Download ZIP</button>
                                    )}
                                </div>
                            </div>

                            <div className="batch-results-grid">
                                {results.map((item, idx) => {
                                    if (item.type === "error") {
                                        return (
                                            <div key={idx} className="error-card">
                                                <span className="error-icon">&#x26A0;</span>
                                                <span className="error-text">{parsedPrompts[item.index]?.title || item.prompt}: {item.error}</span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={idx} className="batch-result-card" style={{ animationDelay: `${idx * 0.08}s` }}>
                                            <img
                                                src={`data:${item.mimeType};base64,${item.data}`}
                                                alt={parsedPrompts[item.index]?.title || item.prompt}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => setLightboxItem({ item, idx })}
                                            />
                                            <div className="batch-result-card-info">
                                                <div className="batch-result-card-title">{parsedPrompts[item.index]?.title || item.prompt}</div>
                                                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                                    <button className="icon-btn" onClick={() => setLightboxItem({ item, idx })} title="View">⇱</button>
                                                    <button className="icon-btn" onClick={() => downloadSingle(item, idx)} title="Download">↓</button>
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
                    <img
                        src={`data:${lightboxItem.item.mimeType};base64,${lightboxItem.item.data}`}
                        alt={parsedPrompts[lightboxItem.item.index]?.title || lightboxItem.item.prompt}
                        className="lightbox-image"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => downloadSingle(lightboxItem.item, lightboxItem.idx)}>↓ Download</button>
                    </div>
                </div>
            )}
        </>
    );
}
