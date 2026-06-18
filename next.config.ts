import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発時に cloudflared / ngrok 等のトンネル経由でスマホ実機確認するための許可。
  // 本番ビルドには影響しない（dev のクロスオリジン資産取得の許可のみ）。
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app"],
  // Turbopack (Next.js 16 default) handles browser-only Node.js builtins automatically.
  // The empty config silences the "webpack config present but no turbopack config" error.
  turbopack: {},
  // Fallback retained for `next build --webpack` and local webpack-mode usage.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
