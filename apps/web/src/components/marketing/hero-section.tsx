'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fadeInUp } from '@/lib/motion';

export function HeroSection() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (search.trim()) {
      router.push(`/check?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleReport = () => {
    router.push('/report');
  };

  return (
    <section className="relative py-16 lg:py-24 overflow-hidden bg-[#1A1A1A]">
      {/* Decorative corner images */}
      <div className="absolute left-0 top-[-30px] w-[100px] h-[185px] z-0">
        <Image
          src="/square.png"
          alt=""
          width={100}
          height={185}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="absolute right-0 bottom-[90px] w-[100px] h-[215px] z-0">
        <Image
          src="/shh.png"
          alt=""
          width={100}
          height={215}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-1/4 left-0 w-64 h-64 bg-purple-900/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-48 h-48 bg-indigo-800/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-purple-900/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-32 h-32 bg-indigo-800/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-purple-900/10 via-transparent to-transparent rounded-full" />
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center text-center">
          <motion.h1
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6 }}
            className="font-heading font-semibold text-3xl md:text-4xl lg:text-5xl leading-tight text-white mb-6"
          >
            Scan and report scams in the Dotsama Ecosystem
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base leading-7 text-gray-500 max-w-2xl mb-10"
          >
            Wisesama defends you against scams, frauds, and other malicious
            entities in the Polkadot and Kusama ecosystem. Scan and report
            suspicious addresses, URLs, Twitter profiles, and more with ease.
          </motion.p>

          <motion.form
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full max-w-2xl mb-8"
            onSubmit={handleSearch}
          >
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <Search className="h-5 w-5" />
              </div>
              <Input
                placeholder="13pkayxsmDRFRQBTUomvs6hmf4SszqKQ6s"
                className="bg-white text-gray-600 placeholder:text-gray-500 pl-12 pr-12 h-14 text-base rounded-xl focus-visible:ring-2 focus-visible:ring-purple-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer"
                onClick={() => handleSearch()}
              >
                <Image src="/scan.png" alt="Search" width={24} height={24} />
              </div>
            </div>
          </motion.form>

          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex gap-4 mb-16"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="gradient"
                className="w-[150px] h-12 rounded-xl font-medium"
                type="submit"
                onClick={() => handleSearch()}
              >
                Search
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                className="w-[150px] h-12 rounded-md border-red-500 text-red-500 bg-transparent hover:bg-red-500/10"
                onClick={handleReport}
              >
                Report
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="relative w-full max-w-4xl"
          >
            <Image
              src="/illustration.svg"
              alt="Scam detection illustration"
              width={800}
              height={400}
              className="w-full h-auto mx-auto"
              priority
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
