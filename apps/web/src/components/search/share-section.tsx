'use client';

import { Copy, Twitter, Send, MessageCircle, Mail, Check } from 'lucide-react';
import { useState } from 'react';

interface ShareSectionProps {
  entity: string;
  entityType: string;
}

export function ShareSection({ entity, entityType }: ShareSectionProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? window.location.href
    : `https://wisesama.com/check/${encodeURIComponent(entity)}`;

  const shareText = `Check the risk assessment for this ${entityType.toLowerCase()} on Wisesama: ${entity}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLinks = [
    {
      name: 'Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Telegram',
      icon: Send,
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Reddit',
      icon: MessageCircle,
      url: `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Email',
      icon: Mail,
      url: `mailto:?subject=${encodeURIComponent('Wisesama Risk Assessment')}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`,
    },
  ];

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <span className="text-sm text-gray-500">Share this result</span>

      <div className="flex items-center gap-2">
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="p-2.5 rounded-full bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white transition-colors"
          title="Copy link"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>

        {/* Social Share Buttons */}
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-full bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white transition-colors"
            title={`Share on ${link.name}`}
          >
            <link.icon className="h-4 w-4" />
          </a>
        ))}
      </div>
    </div>
  );
}
