import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // The CSP browser check needs `next start`. `next dev` evaluates the
    // framework with eval, so it cannot reproduce the integration policy.
    // Set CSP_E2E_BUILD=1 for that production build only. The app typecheck
    // is already red for reasons outside template evaluation.
    ignoreBuildErrors: process.env.CSP_E2E_BUILD === '1',
  },
};

export default nextConfig;
