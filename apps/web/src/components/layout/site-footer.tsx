'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Twitter, Github, Send } from 'lucide-react';
import { fadeInUp } from '@/lib/motion';

const footerLinks = {
  product: [
    { name: 'Scan Entity', href: '/check' },
    { name: 'Report Scam', href: '/report' },
    { name: 'Whitelist Request', href: '/whitelist-request' },
    { name: 'API Docs', href: '/docs' },
  ],
  resources: [
    { name: 'Blog', href: '/blog' },
    { name: 'Whitelist Directory', href: '/whitelist' },
    { name: 'Known Scammers', href: '/blacklist' },
  ],
  community: [
    { name: 'Discord', href: 'https://discord.gg/wisesama' },
    { name: 'Telegram', href: 'https://t.me/wisesama' },
    { name: 'Twitter / X', href: 'https://x.com/wisesama_help' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy-policy' },
    { name: 'Terms of Service', href: '/terms-of-service' },
  ],
};

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const socialLinks = [
  { name: 'Twitter', href: 'https://x.com/wisesama_help', icon: Twitter },
  { name: 'Discord', href: 'https://discord.gg/wisesama', icon: DiscordIcon },
  { name: 'Telegram', href: 'https://t.me/wisesama', icon: TelegramIcon },
  { name: 'GitHub', href: 'https://github.com/itsyogesh/wisesama', icon: Github },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#1A1A1A]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Logo and Description */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="space-y-4"
          >
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Wisesama" width={180} height={30} />
            </Link>
            <p className="text-gray-400 text-base leading-relaxed max-w-[280px]">
              Your defense against scams, frauds, and all things malicious in
              the Polkadot and Kusama ecosystem.
            </p>
            <div className="flex gap-3">
              {socialLinks.map(({ name, href, icon: Icon }) => (
                <Link key={name} href={href} target="_blank" rel="noopener noreferrer">
                  <motion.div
                    whileHover={{ scale: 1.1, backgroundColor: 'rgb(107, 33, 168)' }}
                    whileTap={{ scale: 0.95 }}
                    className="w-11 h-11 bg-[#1F242F] flex items-center justify-center rounded-md transition-colors"
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Product Links */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <h3 className="font-heading font-semibold text-white">Product</h3>
            <div className="space-y-3">
              {footerLinks.product.map(({ name, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-gray-400 hover:text-white transition-colors"
                >
                  {name}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Resources Links */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            <h3 className="font-heading font-semibold text-white">Resources</h3>
            <div className="space-y-3">
              {footerLinks.resources.map(({ name, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-gray-400 hover:text-white transition-colors"
                >
                  {name}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Community Links */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h3 className="font-heading font-semibold text-white">Community</h3>
            <div className="space-y-3">
              {footerLinks.community.map(({ name, href }) => (
                <Link
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-gray-400 hover:text-white transition-colors"
                >
                  {name}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Legal Links */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="space-y-4"
          >
            <h3 className="font-heading font-semibold text-white">Legal</h3>
            <div className="space-y-3">
              {footerLinks.legal.map(({ name, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-gray-400 hover:text-white transition-colors"
                >
                  {name}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Newsletter */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.35 }}
            className="space-y-4"
          >
            <h3 className="font-heading font-semibold text-white">Newsletter</h3>
            <p className="text-gray-400 text-base leading-relaxed">
              Sign up for our newsletter to get the latest news in your inbox.
            </p>
            <div className="flex items-center h-12 rounded-full overflow-hidden bg-white">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-grow h-full px-5 text-sm text-gray-700 placeholder:text-gray-400 bg-transparent border-none focus:outline-none"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-20 h-full flex items-center justify-center rounded-full text-white bg-gradient-to-r from-purple-600 to-purple-500"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 pt-8 text-center border-t border-white/10"
        >
          <p className="text-white text-lg">
            Copyright {new Date().getFullYear()} Wisesama, All Rights Reserved
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
