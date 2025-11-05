import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Disable server-side features for static export
  trailingSlash: true,
  // Configure base path if needed
  // basePath: '',
  assetPrefix: "",
};

export default nextConfig;
