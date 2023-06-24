/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "clips-media-assets2.twitch.tv",
        port: "",
      },
    ],
  },
};

module.exports = nextConfig;
