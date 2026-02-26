import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Nano Banana Studio",
    description:
        "Generate stunning AI image variations with Google Gemini. Space-themed creative studio powered by Nano Banana Pro & Flash.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <div className="starfield" />
                <div className="nebula-glow" />
                {children}
            </body>
        </html>
    );
}
