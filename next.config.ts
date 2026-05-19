import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, x-admin-key, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
