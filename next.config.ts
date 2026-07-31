import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module and must not be bundled by webpack/turbopack.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Keep dynamic pages (home, landscape) in the client router cache so that
    // navigating back to them reuses the render instead of refetching from the
    // server. Default for `dynamic` is 0s, which is why in-app "Back" links to
    // the dynamic home page feel slower than forward links to static routes.
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
};

export default nextConfig;
