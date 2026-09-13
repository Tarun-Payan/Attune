import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pino", "@attune/logger"],
  async rewrites() {
    return [
      {
        source: "/admin/queues",
        destination: `${API_URL}/admin/queues/`,
      },
      {
        source: "/admin/queues/:path*",
        destination: `${API_URL}/admin/queues/:path*`,
      },
    ];
  },
};

export default nextConfig;
