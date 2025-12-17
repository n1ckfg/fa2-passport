import type { Metadata } from "next";
import { Geist, Geist_Mono, DotGothic16 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dotGothic16 = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic16",
});

export const metadata: Metadata = {
  title: "Passport NFT Prototype",
  description: "Mint and display passport NFTs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dotGothic16.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
