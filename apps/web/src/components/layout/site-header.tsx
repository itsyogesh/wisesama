import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Info, LogIn, User, LayoutDashboard, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springTransition } from '@/lib/motion';
import { useAuthStore } from '@/stores/use-auth-store';

const navItems = [
  { name: 'Home', href: '/' },
  { name: 'Report', href: '/report' },
  { name: 'API Docs', href: '/docs' },
];

export function SiteHeader() {
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === href;
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
    setMobileMenuOpen(false);
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
              {mounted ? (
                isAuthenticated ? (
                  <>
                    <Link href="/dashboard">
                      <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </button>
                    </Link>
                    <div className="h-6 w-px bg-white/10" />
                    <button 
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        Log In
                      </button>
                    </Link>
                    <Link href="/register">
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <button className="px-5 py-2 bg-btn-purple rounded-lg font-heading font-semibold text-sm text-white hover:opacity-90 transition-opacity">
                          Sign Up
                        </button>
                      </motion.div>
                    </Link>
                  </>
                )
              ) : (
                // Skeleton loading state to prevent layout shift
                <div className="flex gap-4">
                  <div className="w-16 h-9 bg-white/5 rounded-lg animate-pulse" />
                  <div className="w-24 h-9 bg-white/5 rounded-lg animate-pulse" />
                </div>
              )}
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
                className="md:hidden mt-4 flex flex-col gap-4 overflow-hidden border-t border-white/5 pt-4"
              >
                {navItems.map(({ name, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'font-heading font-semibold text-base tracking-wide transition-all duration-300 relative py-2 px-2',
                      isActive(href)
                        ? 'nav-gradient-text'
                        : 'text-gray-400 hover:text-white'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {name}
                  </Link>
                ))}
                
                <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
                  {mounted && isAuthenticated ? (
                    <>
                      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <button className="flex w-full items-center gap-3 px-2 py-2 text-gray-300 hover:text-white">
                          <LayoutDashboard className="h-5 w-5" />
                          Dashboard
                        </button>
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-2 py-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                      >
                        <LogOut className="h-5 w-5" />
                        Log Out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                        <button className="flex w-full items-center gap-3 px-2 py-2 text-gray-300 hover:text-white">
                          <LogIn className="h-5 w-5" />
                          Log In
                        </button>
                      </Link>
                      <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                        <button className="w-full h-12 bg-btn-purple rounded-lg font-heading font-semibold text-base text-white hover:opacity-90 transition-opacity">
                          Sign Up
                        </button>
                      </Link>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>
    </>
  );
}
