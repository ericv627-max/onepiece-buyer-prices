import type { NextConfig } from "next";

// VENDR is a static site: every page is built ahead of time from the price
// files the nightly GitHub job saves in data/. There is no server, so it
// can't use features that need one (Cache Components, image optimization).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
