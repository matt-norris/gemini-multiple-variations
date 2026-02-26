import Link from "next/link";

interface ApodData {
    title: string;
    date: string;
    explanation: string;
    url: string;
    hdurl?: string;
    media_type: string;
}

async function getApod(): Promise<ApodData | null> {
    try {
        const res = await fetch(
            "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY",
            { next: { revalidate: 3600 } } // cache for 1 hour
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data.media_type !== "image") return null;
        return data;
    } catch {
        return null;
    }
}

export default async function LandingPage() {
    const apod = await getApod();

    return (
        <div className="landing-page">
            {/* Navigation */}
            <nav className="landing-nav">
                <span className="nav-logo">Nano Banana Studio</span>
                <ul className="nav-links">
                    <li>
                        <Link href="/generate">Generate</Link>
                    </li>
                    <li>
                        <Link href="/batch">Batch</Link>
                    </li>
                </ul>
            </nav>

            {/* Hero Section */}
            <section className="hero">
                {apod && (
                    <div className="hero-bg">
                        <img
                            src={apod.hdurl || apod.url}
                            alt={apod.title}
                        />
                    </div>
                )}

                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="hero-badge-dot" />
                        Powered by Google Gemini
                    </div>

                    <h1 className="hero-title">
                        NANO{" "}
                        <span className="gradient-word">BANANA</span>
                        <br />
                        STUDIO
                    </h1>

                    <p className="hero-subtitle">
                        Generate stunning AI image variations with Google&apos;s most
                        advanced image models. Create single prompts or batch
                        generate at scale.
                    </p>

                    {/* Feature Cards */}
                    <div className="feature-cards">
                        <Link href="/generate" className="feature-card">
                            <div className="feature-card-icon">✦</div>
                            <div className="feature-card-title">
                                Single Prompt
                            </div>
                            <div className="feature-card-desc">
                                Generate multiple variations from a single
                                prompt. Fine-tune with negative prompts,
                                references, and aspect ratios.
                            </div>
                            <div className="feature-card-arrow">
                                Launch Studio →
                            </div>
                        </Link>

                        <Link href="/batch" className="feature-card">
                            <div className="feature-card-icon">⚡</div>
                            <div className="feature-card-title">
                                Batch Generator
                            </div>
                            <div className="feature-card-desc">
                                Process multiple prompts at once. Upload CSV
                                files or enter prompts line by line for bulk
                                generation.
                            </div>
                            <div className="feature-card-arrow">
                                Launch Batch →
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* APOD Credit */}
            {apod && (
                <div className="apod-section">
                    <div className="apod-caption">
                        <div className="apod-label">
                            NASA Astronomy Picture of the Day
                        </div>
                        <div className="apod-title">{apod.title}</div>
                        <div className="apod-date">{apod.date}</div>
                        <div className="apod-explanation">
                            {apod.explanation}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
