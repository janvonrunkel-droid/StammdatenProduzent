import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PROJ-19: Redirects für konsolidierte Dokumente-Seite mit Tabs
  async redirects() {
    return [
      {
        source: '/review',
        destination: '/documents?tab=review',
        permanent: true, // 301 redirect
      },
      {
        source: '/duplicates',
        destination: '/documents?tab=duplicates',
        permanent: true, // 301 redirect
      },
    ]
  },
};

export default nextConfig;
