import type { Metadata } from "next";
import { Geist_Mono, M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

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
  title: "ファミマネ",
  description: "家族でたのしくお金を学ぶアプリ",
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
