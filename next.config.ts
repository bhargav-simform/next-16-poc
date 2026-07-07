import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Next.js 16: Cache Components — enables "use cache" / cacheLife / cacheTag
  cacheComponents: true,
};

export default nextConfig;
