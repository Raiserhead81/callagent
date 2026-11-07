import type { NextConfig } from "next";
import path from "path";
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["web-push"],
};
export default nextConfig;
