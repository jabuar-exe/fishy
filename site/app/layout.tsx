import type { Metadata } from "next";
import "./globals.css";
import "./reui.css";

export const metadata: Metadata = {
  title: "Fishy — Aquascape Studio",
  description: "Design your aquarium in 3D, explore original aquascapes, and collect inspiration for your own tank.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: { url: "/brand/fishy-scaping-logo.png", type: "image/png" },
    shortcut: "/brand/fishy-scaping-logo.png",
    apple: "/brand/fishy-scaping-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
