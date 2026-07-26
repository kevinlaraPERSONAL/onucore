import type { MetadataRoute } from "next";

// PWA manifest: name + icons used when the app is installed to the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "onucore",
    short_name: "onucore",
    description: "Tu jefe de gabinete personal",
    start_url: "/",
    display: "standalone",
    background_color: "#1A1A1F",
    theme_color: "#1A1A1F",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
