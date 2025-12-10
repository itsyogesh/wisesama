import Link from "next/link";
import { getAllPosts, formatDate } from "@/lib/blog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | Wisesama",
  description:
    "Stay informed about the latest crypto scams, security threats, and best practices to protect yourself in the Polkadot ecosystem.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div
      className="min-h-screen bg-wisesama-bg"
      style={{
        backgroundImage: "url(/newbg.png)",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      <main className="py-20 lg:py-32">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="font-heading font-bold text-4xl lg:text-5xl text-white mb-4">
              Our Blog
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Stay informed about the latest scams, security threats, and best
              practices to protect yourself in the crypto ecosystem.
            </p>
          </div>

          {/* Blog Posts */}
          <div className="space-y-6">
            {posts.map((post, index) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block group"
              >
                <article className="bg-white rounded-xl p-6 md:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-wisesama-purple font-medium text-sm">
                          {formatDate(post.date)}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500 text-sm">
                          {post.readingTime}
                        </span>
                      </div>

                      <h2 className="font-heading font-semibold text-xl md:text-2xl text-gray-900 mb-2 group-hover:text-wisesama-purple transition-colors">
                        {post.title}
                      </h2>

                      <p className="text-gray-600 line-clamp-2">
                        {post.excerpt}
                      </p>

                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="md:flex-shrink-0">
                      <span className="inline-flex items-center gap-2 text-wisesama-purple font-medium group-hover:gap-3 transition-all">
                        Read More
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {posts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400">
                No blog posts yet. Check back soon!
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
