import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import SolanaWalletProvider from "@/components/providers/WalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bondr",
  description: "Milestone-based escrow payments with multisig security and reputation NFTs.",
  keywords: [
    "Solana",
    "escrow",
    "multisig",
    "freelancers",
    "clients",
    "NFT reputation",
    "secure payments",
    "Bondr"
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SolanaWalletProvider>
          {children}
          <Toaster />
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
