'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Facebook, Twitter, Instagram, Youtube, Send } from 'lucide-react';
import { fadeInUp } from '@/lib/motion';

const footerLinks = {
  company: [
    { name: 'Scan', href: '/check' },
    { name: 'Report', href: '/report' },
    { name: 'API Docs', href: '/docs' },
    { name: 'Blog', href: '/blog' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy-policy' },
    { name: 'Terms of Service', href: '/terms-of-service' },
  ],
};

const socialLinks = [
  { name: 'Facebook', href: 'https://facebook.com', icon: Facebook },
  { name: 'Twitter', href: 'https://twitter.com', icon: Twitter },
  { name: 'Instagram', href: 'https://instagram.com', icon: Instagram },
  { name: 'Youtube', href: 'https://youtube.com', icon: Youtube },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#1A1A1A]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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

          {/* Company Links */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <h3 className="font-heading font-semibold text-white">Company</h3>
            <div className="space-y-3">
              {footerLinks.company.map(({ name, href }) => (
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

          {/* Legal Links */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
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
            transition={{ delay: 0.3 }}
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
