import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Semantic Cache — OpenAI-Compatible LLM Caching Proxy',
  description: 'Reduce LLM costs by 68% with semantic caching. 40ms p95 latency. OpenAI-compatible proxy with PII scrubbing, multi-tenant support, and real-time analytics.',
  openGraph: {
    title: 'Semantic Cache — OpenAI-Compatible LLM Caching Proxy',
    description: 'Reduce LLM costs by 68% with semantic caching. 40ms p95 latency.',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
