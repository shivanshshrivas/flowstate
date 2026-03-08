import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@flowstate/gateway"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
