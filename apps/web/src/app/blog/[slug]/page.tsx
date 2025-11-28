import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar } from 'lucide-react';
import { getPostBySlug, getPostSlugs, formatDate } from '@/lib/blog';
import { MDXRemote } from 'next-mdx-remote-client/rsc';
import type { Metadata } from 'next';
import { Suspense } from 'react';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found | Wisesama',
    };
  }

  return {
    title: `${post.title} | Wisesama Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div
      className="min-h-screen bg-wisesama-bg"
      style={{
        backgroundImage: 'url(/newbg.png)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <main className="py-20 lg:py-32">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Back Link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {/* Article Header */}
          <header className="mb-10">
            <h1 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-white mb-6 leading-tight">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(post.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{post.readingTime}</span>
              </div>
              {post.author && (
                <div className="flex items-center gap-2">
                  <span>By {post.author}</span>
                </div>
              )}
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm font-medium bg-purple-600/20 text-purple-300 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Article Content */}
          <article className="prose prose-invert prose-lg max-w-none">
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 md:p-10 border border-gray-800">
              <Suspense fallback={<div className="animate-pulse">Loading content...</div>}>
                <MDXRemote source={post.content} />
              </Suspense>
            </div>
          </article>

          {/* Footer CTA */}
          <div className="mt-12 p-6 bg-purple-900/20 rounded-xl border border-purple-500/30">
            <h3 className="font-heading font-semibold text-xl text-white mb-2">
              Protect Yourself Today
            </h3>
            <p className="text-gray-400 mb-4">
              Use Wisesama to verify addresses and URLs before transacting. Stay safe in the crypto
              ecosystem.
            </p>
            <Link
              href="/check"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-wisesama-purple text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
            >
              Check an Address
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
        </div>
      </main>
    </div>
  );
}
