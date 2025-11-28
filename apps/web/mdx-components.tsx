import type { ReactNode } from 'react';

type MDXComponents = {
  [key: string]: React.ComponentType<{ children?: ReactNode; href?: string }>;
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }: { children?: ReactNode }) => (
      <h1 className="font-heading font-bold text-3xl md:text-4xl text-white mb-6">{children}</h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="font-heading font-semibold text-2xl text-white mt-8 mb-4">{children}</h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3 className="font-heading font-semibold text-xl text-white mt-6 mb-3">{children}</h3>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p className="text-gray-300 leading-relaxed mb-4">{children}</p>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2">{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => <li className="text-gray-300">{children}</li>,
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
      <a
        href={href}
        className="text-wisesama-purple hover:text-purple-400 underline transition-colors"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="border-l-4 border-wisesama-purple pl-4 my-4 italic text-gray-400">
        {children}
      </blockquote>
    ),
    code: ({ children }: { children?: ReactNode }) => (
      <code className="bg-gray-800 text-purple-300 px-1.5 py-0.5 rounded text-sm">{children}</code>
    ),
    pre: ({ children }: { children?: ReactNode }) => (
      <pre className="bg-gray-800 rounded-lg p-4 overflow-x-auto mb-4">{children}</pre>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    ...components,
  };
}
