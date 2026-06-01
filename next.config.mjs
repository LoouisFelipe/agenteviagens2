/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === "true" || (!process.env.NEXT_PRIVATE_STANDALONE && !process.env.PORT);

const nextConfig = {
  output: isStatic ? "export" : "standalone",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

