import type { Metadata } from "next";
import { Geist_Mono, M_PLUS_Rounded_1c } from "next/font/google";
import Script from "next/script";
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
  title: "ミラマネ",
  description: "家族でたのしくお金を学ぶアプリ",
  themeColor: "#4BAF57",
  appleWebApp: {
    capable: true,
    title: "ミラマネ",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "ミラマネ",
    description: "家族でたのしくお金を学ぶアプリ",
    url: siteUrl,
  type: "website",
    images: [
      {
        url: "/miramane_ogp.png?v=1",
        width: 1731,
        height: 909,
        alt: "ミラマネのOGP画像",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ミラマネ",
    description: "家族でたのしくお金を学ぶアプリ",
    images: [
      {
        url: "/miramane_ogp.png?v=1",
        width: 1731,
        height: 909,
        alt: "ミラマネのOGP画像",
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
      className={`${roundedSans.variable} ${geistMono.variable} antialiased`}
    >
      {/* Google Tag Manager。<head> 相当の早い段階で dataLayer を初期化する。 */}
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KB89XF7R');`}
      </Script>
      {/* html を固定高にしない（min-height は globals の body 側で 100dvh 指定）。
          iOS standalone PWA で position:fixed のフッターがスクロール時に
          下端へ追従しなくなる問題を防ぐため、ウィンドウをスクローラにする。 */}
      <body className="flex flex-col">
        {/* Google Tag Manager (noscript)。<body> 直後に配置する。 */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KB89XF7R"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
      </body>
      {/* Google AdSense ローダー。next/script が <head> 相当の最適化読み込みを行う。 */}
      <Script
        id="google-adsense"
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9176462458276131"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      {/* Google Analytics (gtag.js)。ローダーと初期化の2スクリプト構成。 */}
      <Script
        id="google-analytics-loader"
        async
        src="https://www.googletagmanager.com/gtag/js?id=G-55JXTNPFB2"
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-55JXTNPFB2');`}
      </Script>
    </html>
  );
}
