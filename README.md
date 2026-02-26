# Open Banana 🍌

Generate multiple AI image variations from a single prompt using Google's **Nano Banana Pro** (`gemini-3-pro-image-preview`) and **Nano Banana Flash** (`gemini-2.5-flash-image`) image generation models.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### Core
- **Multiple Variations** — Generate 1–8 unique image variations from one prompt
- **Batch Generator** — Upload a `.txt` file with numbered prompts to generate images in bulk
- **Real-Time Streaming** — Images appear progressively as they're generated via SSE
- **One-Click Download** — Save any generated image as PNG or download all as a ZIP
- **Progress Tracking** — Visual progress bar shows generation status

### Model Selection
- **Nano Banana Pro** — Advanced reasoning ("Thinking"), up to 14 reference images, 4K resolution, Google Search grounding
- **Nano Banana Flash** — Optimized for speed, up to 3 reference images, 1K resolution

### Reference Image Upload
- **Drag & drop** or click-to-browse upload zone
- Upload up to **14 reference images** (Pro) or **3 images** (Flash)
- Supports PNG, JPG, and WEBP formats
- Thumbnail previews with remove buttons
- Use for image editing, style transfer, composition, character consistency, and more

### Prompt Controls
- **Negative Prompt Presets** — 8 curated presets for common use cases:
  - General Quality, Photorealistic, Cartoon/Illustration, Portrait, Landscape/Nature, Abstract Art, Product Shot, Food Photography
- **Custom Negative Prompts** — Edit presets or write your own

### Output Settings
- **10 Aspect Ratios** — 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 5:4, 4:5, 21:9
- **Resolution** — 1K, 2K, or 4K (2K and 4K available on Pro only)
- **Google Search Grounding** — Toggle to let the model use real-time data from Google Search (Pro only)

### Landing Page
- **NASA APOD Integration** — Displays the Astronomy Picture of the Day as the hero background
- **Space Theme** — Animated starfield, glassmorphic UI, gradient accents

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/open-banana.git
cd open-banana
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Your API Key

Create a `.env.local` file in the project root:

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

1. **Choose a mode** — Single Prompt Studio or Batch Generator
2. **Choose a model** — Nano Banana Pro (quality) or Flash (speed)
3. **Select an aspect ratio** from the visual ratio card picker
4. *(Optional)* **Upload reference images** for editing, style transfer, or composition
5. **Enter a prompt** describing the image you want
6. *(Optional)* **Select a negative prompt preset** and customize it
7. **Configure** resolution and number of variations
8. *(Optional)* **Enable Google Search Grounding** for real-time data
9. Click **Generate Variations**
10. Images stream to your browser in real-time — download any with one click

### Architecture

```
Browser
    │
    ├── Landing Page (/)           — NASA APOD hero, feature cards
    ├── Single Prompt (/generate)  — Multi-variation generation
    ├── Batch Generator (/batch)   — Bulk prompt processing
    │
    ├── POST /api/generate
    │       ├── Build parts: [text prompt, ...reference images]
    │       ├── Config: model, aspect ratio, resolution, search tools
    │       ├── Loop N times (sequential)
    │       │       └── Gemini API → generateContentStream()
    │       └── SSE stream (image data as base64)
    │
    └── POST /api/batch
            ├── Process array of prompts sequentially
            └── SSE stream (image data + progress)
```

---

## Nano Banana Models

| Feature | Nano Banana Pro | Nano Banana Flash |
|---|---|---|
| Model ID | `gemini-3-pro-image-preview` | `gemini-2.5-flash-image` |
| Reference Images | Up to 14 (6 objects + 5 people) | Up to 3 |
| Resolution | 1K, 2K, 4K | 1K |
| Thinking Mode | ✅ Built-in reasoning | — |
| Search Grounding | ✅ Google Search | — |
| Speed | Standard | Fast |

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) | React framework with App Router |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [@google/genai](https://www.npmjs.com/package/@google/genai) | Google Gemini SDK |
| Vanilla CSS | Space theme with animated starfield & glassmorphic design |

---

## Project Structure

```
open-banana/
├── app/
│   ├── api/
│   │   ├── generate/
│   │   │   └── route.ts        # Single prompt API — SSE streaming
│   │   └── batch/
│   │       └── route.ts        # Batch generation API — SSE streaming
│   ├── generate/
│   │   └── page.tsx            # Single Prompt Studio UI
│   ├── batch/
│   │   └── page.tsx            # Batch Generator UI
│   ├── globals.css             # Space theme design system
│   ├── layout.tsx              # Root layout with metadata
│   └── page.tsx                # Landing page with NASA APOD
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
