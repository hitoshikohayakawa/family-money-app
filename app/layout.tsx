import type { Metadata } from "next";
import { Geist_Mono, M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const roundedSans = M_PLUS_Rounded_1c({
  variable: "--font-rounded-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ファミマネ",
  description: "家族でたのしくお金を学ぶアプリ",
  openGraph: {
    title: "ファミマネ",
    description: "家族でたのしくお金を学ぶアプリ",
    url: "https://family-money-app-one.vercel.app",
  type: "website",
    images: [
      {
        url: "/famimane_ogp.png?v=2",
        width: 1733,
        height: 907,
        alt: "ファミマネのOGP画像",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ファミマネ",
    description: "家族でたのしくお金を学ぶアプリ",
    images: [
      {
        url: "/famimane_ogp.png?v=2",
        width: 1733,
        height: 907,
        alt: "ファミマネのOGP画像",
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
    <html
      lang="ja"
      className={`${roundedSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
