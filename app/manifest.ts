import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ミラマネ",
    short_name: "ミラマネ",
    description: "家族でたのしくお金を学ぶアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#F4FAF5",
    theme_color: "#4BAF57",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
