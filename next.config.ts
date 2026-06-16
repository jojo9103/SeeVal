import type { NextConfig } from "next";

const serverActionBodyLimit = (process.env.SEEV_SERVER_ACTION_BODY_LIMIT ??
  "1gb") as NonNullable<
  Extract<NonNullable<NextConfig["experimental"]>["serverActions"], object>
>["bodySizeLimit"];

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["192.168.200.22"],
  experimental: {
    serverActions: {
      bodySizeLimit: serverActionBodyLimit,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "same-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
