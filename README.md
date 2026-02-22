# Gemini Multiple Variations

Generate multiple AI image variations from a single prompt using Google's **Nano Banana Pro** (`gemini-3-pro-image-preview`) and **Nano Banana** (`gemini-2.5-flash-image`) image generation models.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### Core
- **Multiple Variations** — Generate 1–8 unique image variations from one prompt
- **Real-Time Streaming** — Images appear progressively as they're generated via SSE
- **One-Click Download** — Save any generated image as PNG directly to your device
- **Progress Tracking** — Visual progress bar shows generation status

### Model Selection
- **Nano Banana Pro** — Advanced reasoning ("Thinking"), up to 14 reference images, 4K resolution, Google Search grounding
- **Nano Banana (Flash)** — Optimized for speed, up to 3 reference images, 1K resolution

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

1. **Choose a model** — Nano Banana Pro (quality) or Flash (speed)
2. **Select an aspect ratio** from the visual ratio card picker
3. *(Optional)* **Upload reference images** for editing, style transfer, or composition
4. **Enter a prompt** describing the image you want
5. *(Optional)* **Select a negative prompt preset** and customize it
6. **Configure** resolution and number of variations
7. *(Optional)* **Enable Google Search Grounding** for real-time data
8. Click **Generate Variations**
9. Images stream to your browser in real-time — download any with one click

### Architecture

```
Browser (page.tsx)
    │
    ├── Model selection (Pro / Flash)
    ├── Reference image upload (base64)
    │
    ├── POST /api/generate
    │       │
    │       ├── Build parts: [text prompt, ...reference images]
    │       ├── Config: model, aspect ratio, resolution, search tools
    │       ├── Loop N times (sequential)
    │       │       └── Gemini API → generateContentStream()
    │       │           └── Filter out "thought" images (Pro)
    │       │
    │       └── SSE stream (image data as base64)
    │
    └── Render images in gallery as they arrive
```

---

## Nano Banana Models

| Feature | Nano Banana Pro | Nano Banana (Flash) |
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
| Vanilla CSS | Custom dark theme with animated gradient backgrounds |

---

## Project Structure

```
gemini-multiple-variations/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts        # API route — image generation with SSE streaming
│   ├── globals.css             # Dark theme design system
│   ├── layout.tsx              # Root layout with metadata
│   └── page.tsx                # Main UI — upload, controls, gallery, progress
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
