import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Doto, Schibsted_Grotesk } from "next/font/google";

import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { AuthProvider } from "@/lib/auth";

import "./globals.css";

// Stadium-signage display face, a newsroom grotesk for reading, and a dot-matrix
// scoreboard face for numbers that tick.
const display = Big_Shoulders({ variable: "--ff-display", subsets: ["latin"], axes: ["opsz"] });
const body = Schibsted_Grotesk({ variable: "--ff-body", subsets: ["latin"] });
const score = Doto({ variable: "--ff-score", subsets: ["latin"], weight: ["700", "900"] });

export const metadata: Metadata = {
  title: "Footlas: learn football by playing",
  description:
    "Learn about countries, clubs, players and football history through quick daily games.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1811" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${score.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <AuthProvider>
            <Header />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-6 sm:pt-10 sm:pb-12">
              {children}
            </main>
            <footer className="mx-auto w-full max-w-5xl px-4 pt-2 pb-28 text-xs text-muted sm:pb-6">
              Footlas is free to learn, forever.{" "}
              <a
                href="https://buymeacoffee.com/itrixy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Buy me a coffee
              </a>
            </footer>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
