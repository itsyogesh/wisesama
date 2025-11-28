'use client';

import { motion } from 'motion/react';
import Link from 'next/link';

// Static blog data with gradient placeholders
const blogPosts = [
  {
    title: 'How to Identify Crypto Scams in the Polkadot Ecosystem',
    date: 'December 2024',
    gradient: 'from-purple-900 via-indigo-900 to-purple-800',
    slug: '/blog/identify-crypto-scams',
  },
  {
    title: 'Understanding Address Phishing Attacks and How to Stay Safe',
    date: 'November 2024',
    gradient: 'from-violet-900 via-purple-900 to-fuchsia-900',
    slug: '/blog/address-phishing-attacks',
  },
  {
    title: 'The Rise of Scam Tokens: What You Need to Know',
    date: 'November 2024',
    gradient: 'from-indigo-900 via-purple-800 to-pink-900',
    slug: '/blog/scam-tokens-guide',
  },
  {
    title: 'Protecting Your Assets: Best Practices for Web3 Security',
    date: 'October 2024',
    gradient: 'from-purple-800 via-violet-900 to-indigo-900',
    slug: '/blog/web3-security-best-practices',
  },
];

interface BlogCardProps {
  title: string;
  date: string;
  gradient: string;
  slug: string;
}

function BlogCard({ title, date, gradient, slug }: BlogCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Link href={slug} className="block">
        <div className={`relative rounded-xl overflow-hidden bg-gradient-to-br ${gradient} h-[320px] flex flex-col`}>
          {/* Gradient image placeholder */}
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-black/20" />
            {/* Subtle pattern overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Date badge */}
            <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-purple-600 text-white mb-3">
              {date}
            </span>

            {/* Title */}
            <h3 className="font-heading font-semibold text-lg text-white line-clamp-2 mb-4">
              {title}
            </h3>

            {/* Read Full button */}
            <button className="px-4 py-2 text-sm font-semibold rounded-md bg-wisesama-red text-white hover:bg-red-600 transition-colors">
              Read Full
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function BlogsSection() {
  return (
    <section className="py-16 bg-wisesama-bg">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-white mb-4">
            Our Blogs
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Horrors lurking in the crypto world. Stay informed about the latest scams, security threats, and how to protect yourself.
          </p>
        </div>

        {/* Blog Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ staggerChildren: 0.1 }}
        >
          {blogPosts.map((post) => (
            <BlogCard key={post.slug} {...post} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
