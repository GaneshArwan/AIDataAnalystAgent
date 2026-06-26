import type { NextConfig } from "next";

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // Prevents clickjacking
          { key: "X-Content-Type-Options", value: "nosniff" }, // Prevents MIME type sniffing
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // Protects referer leakage
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" } // Enforces HTTPS
        ],
      },
    ];
  },
  // Silencing the Next.js multiple lockfiles turbopack root warning
  // by explicitly setting the project root.
  // @ts-ignore
  turbopack: {
    root: process.cwd(),
  },
} as NextConfig;

export default nextConfig;
