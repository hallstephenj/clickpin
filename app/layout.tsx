import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./forstall.css";
import "./neo2026.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ForstallModeProvider } from "@/components/ForstallModeProvider";
import { PasswordGate } from "@/components/PasswordGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://clickpin.io"),
  title: "clickpin",
  description: "Anonymous, hyperlocal message board. Posts are tied to physical locations — you can only see and create posts when you're actually there. No accounts, no followers, no algorithms.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "clickpin",
    description: "Anonymous, hyperlocal message board. Posts are tied to physical locations — you can only see and create posts when you're actually there.",
    url: "https://clickpin.io",
    siteName: "clickpin",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
        alt: "clickpin - anonymous hyperlocal message board",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "clickpin",
    description: "Anonymous, hyperlocal message board. Posts are tied to physical locations — you can only see and create posts when you're actually there.",
    images: ["/opengraph.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "clickpin",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#92400e",
};

// Blocking script to apply theme before paint
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('clickpin_theme');
    if (theme === 'forstall') {
      document.documentElement.classList.add('forstall-mode');
    } else if (theme === 'neo2026') {
      document.documentElement.classList.add('neo2026-mode');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PasswordGate>
          <AuthProvider>
            <ForstallModeProvider>{children}</ForstallModeProvider>
          </AuthProvider>
        </PasswordGate>
      </body>
    </html>
  );
}
