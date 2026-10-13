import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // small Docker image
  reactStrictMode: true,
};

export default nextConfig;
