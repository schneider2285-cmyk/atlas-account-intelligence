import type { Metadata } from "next";
import { DM_Sans, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/components/providers/TRPCProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatDrawer } from "@/components/chat/ChatDrawer";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yahoo Hiring Tracker",
  description: "Track and manage Yahoo contractor hiring pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${fraunces.variable} ${geistMono.variable} antialiased`}
      >
        <TRPCProvider>
          <TooltipProvider>
            {children}
            <ChatDrawer />
          </TooltipProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
