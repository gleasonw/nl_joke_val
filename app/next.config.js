/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "clips-media-assets2.twitch.tv",
        pathname: "/**",
        port: "",
      },
    ],
  },
};

module.exports = nextConfig;
