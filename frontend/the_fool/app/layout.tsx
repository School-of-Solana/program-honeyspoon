import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";
import "nes.css/css/nes.min.css";
import { WalletProvider } from "@/components/WalletProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { SolanaStatusBanner } from "@/components/SolanaStatusBanner";

const pressStart2P = Press_Start_2P({
  weight: "400",
  variable: "--font-nes",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deep Sea Diver - The Fool",
  description: "A deep sea diving game on Solana",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤿</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
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
        <QueryProvider>
          <WalletProvider>
            <SolanaStatusBanner />
            {children}
          </WalletProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
