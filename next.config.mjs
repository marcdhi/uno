/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    remotePatterns: [],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize ffmpeg packages to prevent bundling issues
      config.externals.push('ffmpeg-static');
      
      // Ensure binary files are not bundled
      config.module.rules.push({
        test: /\.(node|exe)$/,
        use: 'file-loader',
      });
    }
    return config;
  },
};

export default nextConfig;
