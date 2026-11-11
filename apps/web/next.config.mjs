/**
 * Two build targets from one config:
 *
 *  * default (`next build`)        - server build for Vercel / the container image,
 *                                    with security headers.
 *  * `NEXT_STATIC_EXPORT=true`     - fully static export for GitHub Pages, where the
 *                                    studio runs in demo mode (no API configured).
 *                                    `headers()` is not supported by `output: export`,
 *                                    so it is only added on the server build.
 */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";
/** Project Pages live under /<repo>; user Pages and Vercel do not need a prefix. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are consumed as TypeScript source, so Next compiles them.
  transpilePackages: ["@ai3d/scene-core", "@ai3d/editor", "@ai3d/shared-types", "@ai3d/ui"],
  experimental: {
    // three.js ships large ESM graphs; keep the bundle analysable.
    optimizePackageImports: ["@react-three/drei"],
  },
  eslint: { ignoreDuringBuilds: true },
  ...(isStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        basePath,
        assetPrefix: basePath || undefined,
        images: { unoptimized: true },
      }
    : {}),
  webpack: (config) => {
    // Workspace packages use NodeNext-style relative specifiers ("./types.js")
    // that must resolve to their TypeScript sources during the build.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
  webpack: (config) => {
    // Workspace packages use NodeNext-style relative specifiers ("./types.js")
    // that must resolve to their TypeScript sources during the build.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
  poweredByHeader: false,
  async headers() {
    if (isStaticExport) return [];
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
