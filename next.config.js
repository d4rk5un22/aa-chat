/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config, { isServer, dev }) => {
    // Suppress Buffer() deprecation warnings
    config.ignoreWarnings = [
      { module: /node_modules\/pdf-parse/ },
      { module: /node_modules\/styled-jsx/ },
      { module: /node_modules\/safe-buffer/ }
    ];

    // Handle Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
        aws4: false,
        'timers/promises': false,
        timers: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        util: require.resolve('util/'),
        process: require.resolve('process/browser'),
      };

      // Add buffer to providePlugin
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );

      // Add resolve alias for browser-specific modules
      config.resolve.alias = {
        ...config.resolve.alias,
        process: 'process/browser',
      };
    }

    return config;
  }
}

module.exports = nextConfig
