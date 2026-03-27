import type { Metadata } from 'next';

const BASE_URL = 'https://wisesama.com';

export function createPageMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const ogImage = `${BASE_URL}/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;

  return {
    title,
    description,
    ...(noindex && { robots: { index: false, follow: false } }),
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}${path}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}
