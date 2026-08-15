import type { NextConfig } from "next";

const isMobileBuild = process.env.MOBILE_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isMobileBuild
      ? {
        output: "export" as const,
        images: { unoptimized: true },
        trailingSlash: true,
        distDir: ".next-mobile",
        typescript: { ignoreBuildErrors: true },
      }
    : {}),
};

export default nextConfig;