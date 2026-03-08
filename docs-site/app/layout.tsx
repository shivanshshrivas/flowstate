import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import "nextra-theme-docs/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FlowState Docs",
    template: "%s | FlowState Docs",
  },
  description:
    "Developer documentation for @shivanshshrivas/flowstate — one-click crypto checkout, event-based escrow, and Shippo shipping tracking for e-commerce platforms.",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#111319" },
  ],
};

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const navbar = (
  <Navbar
    logo={
      <span className="fs-brand">
        <span className="fs-brand-mark" aria-hidden="true">
          F
        </span>
        <span className="fs-brand-copy">
          <span>FlowState</span>
          <small>Developer Docs</small>
        </span>
      </span>
    }
    projectLink="https://github.com/shivanshshrivas/flowstate"
  />
);

const footer = (
  <Footer>
    <span>FlowState docs track the current repository implementation.</span>
  </Footer>
);

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pageMap = await getPageMap();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${mono.variable}`}>
        <Layout
          editLink="Edit this page on GitHub"
          docsRepositoryBase="https://github.com/shivanshshrivas/flowstate/tree/main/docs-site/app"
          feedback={{
            content: "Question or gap? Open a docs issue.",
            labels: "documentation",
            link: "https://github.com/shivanshshrivas/flowstate/issues/new?labels=documentation",
          }}
          footer={footer}
          navbar={navbar}
          navigation={{
            prev: true,
            next: true,
          }}
          pageMap={pageMap}
          sidebar={{
            autoCollapse: true,
            defaultMenuCollapseLevel: 1,
            toggleButton: true,
          }}
          toc={{
            backToTop: "Back to top",
          }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
