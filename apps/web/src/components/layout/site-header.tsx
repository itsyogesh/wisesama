'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { springTransition } from '@/lib/motion';

const navItems = [
  { name: 'Home', href: '/' },
  { name: 'Report', href: '/report' },
  { name: 'API Docs', href: '/docs' },
];

export function SiteHeader() {
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Info Banner */}
      <AnimatePresence>
        {showInfoBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className="bg-info-banner w-full h-10 px-4"
          >
            <div className="container mx-auto flex items-center justify-center h-full relative">
              <div className="flex items-center gap-2 text-white">
                <Info className="h-4 w-4" />
                <span className="font-heading font-semibold text-sm">
                  Protecting the Polkadot ecosystem from fraud
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowInfoBanner(false)}
                className="absolute right-0 text-white hover:text-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/95 backdrop-blur-sm text-white sticky top-0 z-50 border-b border-white/5"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={springTransition}
              >
                <Image
                  src="/logo.svg"
                  alt="Wisesama"
                  width={180}
                  height={30}
                  priority
                />
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map(({ name, href }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'font-heading font-semibold text-base tracking-wide transition-all duration-300 relative py-2',
                    isActive(href)
                      ? 'nav-gradient-text'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    transition={springTransition}
                  >
                    {name}
                  </motion.span>
                  {isActive(href) && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-wisesama-purple-accent"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/check">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <button className="w-[149px] h-[46px] bg-btn-purple rounded-[5px] font-heading font-semibold text-base text-white hover:opacity-90 transition-opacity">
                    Check Address
                  </button>
                </motion.div>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </motion.button>
          </div>

          {/* Mobile Navigation */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="md:hidden mt-4 flex flex-col gap-4 overflow-hidden"
              >
                {navItems.map(({ name, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'font-heading font-semibold text-base tracking-wide transition-all duration-300 relative py-2',
                      isActive(href)
                        ? 'nav-gradient-text'
                        : 'text-gray-400 hover:text-white'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      transition={springTransition}
                    >
                      {name}
                    </motion.span>
                    {isActive(href) && (
                      <motion.div
                        layoutId="activeNavMobile"
                        className="absolute -bottom-1 left-0 right-0 h-0.5 bg-wisesama-purple-accent"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                  </Link>
                ))}
                <Link href="/check" onClick={() => setMobileMenuOpen(false)}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <button className="w-full h-[46px] bg-btn-purple rounded-[5px] font-heading font-semibold text-base text-white hover:opacity-90 transition-opacity">
                      Check Address
                    </button>
                  </motion.div>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>
    </>
  );
}
