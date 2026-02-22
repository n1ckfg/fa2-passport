import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Use webpack for both dev and build to handle problematic dependencies
  webpack: (config, { isServer }) => {
    // Ignore test files and other non-essential files from node_modules
    config.module.rules.push({
      test: /node_modules\/.*\/(test|tests|__tests__|\.test\.|\.spec\.|bench|benchmark)/,
      use: 'ignore-loader',
    });

    // Ignore LICENSE and README files that might cause parsing issues
    config.module.rules.push({
      test: /node_modules\/.*\/(LICENSE|README|CHANGELOG|\.md)$/,
      use: 'ignore-loader',
    });

    // Handle Node.js modules that shouldn't be bundled for client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    return config;
  },
};

export default nextConfig;
