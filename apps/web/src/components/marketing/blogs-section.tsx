'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import Balancer from 'react-wrap-balancer';
import type { BlogPostMeta } from '@/lib/blog';

interface BlogCardProps {
  title: string;
  date: string;
  excerpt: string;
  slug: string;
  featured?: boolean;
}

function BlogCard({ title, date, excerpt, slug, featured = false }: BlogCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Link href={`/blog/${slug}`} className="block h-full">
        <div className="bg-zinc-900/80 border border-white/10 rounded-xl p-6 h-full flex flex-col min-h-[280px] backdrop-blur-sm transition-colors hover:border-wisesama-purple/50">
          {/* Date */}
          <span className="text-wisesama-purple font-medium text-sm mb-3">{date}</span>

          {/* Title */}
          <h3 className="font-heading font-semibold text-xl text-white mb-3 line-clamp-2">
            {title}
          </h3>

          {/* Excerpt */}
          <p className="text-gray-400 text-sm leading-relaxed line-clamp-3 mb-6 flex-1">
            {excerpt}
          </p>

          {/* Read Full button */}
          <div className="mt-auto">
            <button
              className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                featured
                  ? 'bg-wisesama-purple text-white hover:bg-purple-600'
                  : 'border border-white/20 text-gray-300 hover:border-wisesama-purple hover:text-wisesama-purple'
              }`}
            >
              Read Full
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

interface BlogsSectionProps {
  posts: BlogPostMeta[];
}

export function BlogsSection({ posts }: BlogsSectionProps) {
  // Take only first 4 posts for homepage
  const displayPosts = posts.slice(0, 4);

  return (
    <section className="py-16 bg-[#0B0B11]">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20 mb-6">
            <Newspaper className="w-4 h-4 text-wisesama-purple-light" />
            <span className="text-sm font-medium text-wisesama-purple-light">
              Latest Updates
            </span>
          </div>
          <h2 className="font-heading font-semibold text-4xl md:text-5xl text-white mb-4">
            <Balancer>
              Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">Blogs</span>
            </Balancer>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            <Balancer>
              Stay informed about the latest scams, security threats, and best practices to protect
              yourself in the crypto ecosystem.
            </Balancer>
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
          {displayPosts.map((post, index) => (
            <BlogCard
              key={post.slug}
              title={post.title}
              date={post.date}
              excerpt={post.excerpt}
              slug={post.slug}
              featured={index === 0}
            />
          ))}
        </motion.div>

        {/* View All Link */}
        {posts.length > 4 && (
          <div className="text-center mt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-wisesama-purple hover:text-purple-400 transition-colors font-medium"
            >
              View All Posts
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
