# Gemini Multiple Variations

Generate multiple AI image variations from a single prompt using Google's **Gemini** image generation model (`gemini-3-pro-image-preview`).

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Multiple Variations** — Generate 1–8 unique image variations from one prompt
- **Negative Prompts** — Specify what to avoid (blur, artifacts, watermarks, etc.)
- **Aspect Ratio** — Choose from 1:1, 16:9, 9:16, 4:3, or 3:4
- **Resolution** — Select 512px, 1K, or 2K output size
- **Real-Time Streaming** — Images appear progressively as they're generated via SSE
- **One-Click Download** — Save any generated image directly to your device
- **Progress Tracking** — Visual progress bar shows generation status

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/gemini-multiple-variations.git
cd gemini-multiple-variations
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Your API Key

Create a `.env.local` file in the project root (or edit the existing one):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note:** `.env.local` is included in `.gitignore` and will **never** be committed to version control. Your API key stays safe.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How It Works

1. **Enter a prompt** describing the image you want
2. *(Optional)* Add a **negative prompt** to avoid unwanted features
3. **Select** your preferred aspect ratio, resolution, and number of variations
4. Click **Generate Variations**
5. Images are generated **sequentially** via the Gemini API and streamed to your browser in real-time
6. **Download** any image with a single click

### Architecture

```
Browser (page.tsx)
    │
    ├── POST /api/generate
    │       │
    │       ├── Loop N times (sequential)
    │       │       └── Gemini API → generateContentStream()
    │       │
    │       └── SSE stream (image data as base64)
    │
    └── Render images in gallery as they arrive
```

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) | React framework with App Router |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [@google/genai](https://www.npmjs.com/package/@google/genai) | Google Gemini SDK |
| Vanilla CSS | Custom dark theme with gradient accents |

---

## Project Structure

```
gemini-multiple-variations/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts        # API route — sequential image generation with SSE
│   ├── globals.css             # Dark theme design system
│   ├── layout.tsx              # Root layout with metadata
│   └── page.tsx                # Main UI — controls, gallery, progress
├── .env.local                  # Your API key (not committed)
├── .gitignore
├── package.json
└── README.md
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key from [AI Studio](https://aistudio.google.com/apikey) |

---

## License

MIT
