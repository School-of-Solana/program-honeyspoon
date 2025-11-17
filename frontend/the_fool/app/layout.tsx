import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";
import "nes.css/css/nes.min.css";
import { WalletProvider } from "@/components/WalletProvider";
import { SolanaStatusBanner } from "@/components/SolanaStatusBanner";

const pressStart2P = Press_Start_2P({
  weight: "400",
  variable: "--font-nes",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deep Sea Diver - The Fool",
  description: "A deep sea diving game on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${pressStart2P.variable} antialiased`}
        style={{ fontFamily: "var(--font-nes), monospace" }}
      >
        <WalletProvider>
          <SolanaStatusBanner />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
