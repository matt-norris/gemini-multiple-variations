import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Gemini Multiple Variations",
    description:
        "Generate multiple AI image variations with Google Gemini. Customize prompts, negative prompts, resolution, and aspect ratio.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
