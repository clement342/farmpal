import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineDetector } from "@/components/pwa/OfflineDetector";
import { SWRegister } from "@/components/pwa/SWRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FarmPal — Offline AI Crop Disease Diagnosis",
  description:
    "Diagnose crop diseases anywhere, even offline. FarmPal runs a local AI model on your device for private, instant crop disease diagnosis through natural conversation.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "FarmPal",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/favicon.svg",
    apple: "/icons/apple-touch-icon.svg",
  },
  openGraph: {
    title: "FarmPal — Offline AI Crop Disease Diagnosis",
    description:
      "Diagnose crop diseases anywhere, even offline. Powered by Google Gemma.",
  },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SWRegister />
        <OfflineDetector />
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
