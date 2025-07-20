import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const manifest = {
    name: "OneTimeShow",
    short_name: "OneTimeShow",
    description: "Live video streaming platform",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#007AFF",
    orientation: "portrait-primary",
    scope: "/",
    lang: "en",
    icons: [
      {
        src: "/icon-16x16.svg",
        sizes: "16x16",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: "/icon-32x32.svg",
        sizes: "32x32",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: "/icon-192x192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: "/icon-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: "/apple-touch-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml"
      }
    ],
    categories: ["entertainment", "social", "video"],
    screenshots: [
      {
        src: "https://onetimeshow.app/screenshot-wide.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide"
      },
      {
        src: "https://onetimeshow.app/screenshot-narrow.png",
        sizes: "750x1334",
        type: "image/png",
        form_factor: "narrow"
      }
    ]
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.status(200).json(manifest);
} 