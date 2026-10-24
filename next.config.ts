import type { NextConfig } from "next";

// Kept close to the create-next-app 16.4 template.
// cacheComponents / partialPrefetching are intentionally OFF to keep the
// rendering model simple for the hackathon. Turn them on later if needed.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Score + program JSON are read from disk by API routes; make sure they
  // ship with the server build.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
    "/report": ["./data/**/*"],
  },
};

export default nextConfig;
