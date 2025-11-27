'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.18,
    },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 80, damping: 18 },
  },
};

const iconVariants = {
  hidden: { scale: 0, rotate: -30 },
  show: {
    scale: 1,
    rotate: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 10 },
  },
};

export function FeaturesSection() {
  return (
    <section
      className="py-20 lg:py-32 relative overflow-visible bg-[#1A1A1A]"
      style={{
        backgroundImage: 'url(/allbg.png)',
        backgroundSize: 'auto',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading font-bold text-4xl md:text-5xl text-white mb-4">
            Our Features
          </h2>
        </motion.div>

        {/* 2x2 Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 lg:gap-16 items-stretch justify-center relative"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {/* Scan Card */}
          <div className="relative flex flex-col items-center justify-center">
            <motion.div
              className="absolute -top-10 left-[30%] z-20 pointer-events-none w-[204px] h-[204px] rounded-[50px]"
            >
              <Image
                src="/circless.png"
                alt=""
                width={120}
                height={150}
                className="w-full h-full object-contain mt-16"
              />
            </motion.div>

            <motion.div
              variants={cardVariants}
              whileHover={{ scale: 1.04 }}
              className="w-full flex justify-center"
            >
              <Card className="bg-transparent border-white rounded-2xl mt-32 pt-12 pb-6 px-4 min-h-[450px] w-full max-w-[400px] flex flex-col justify-between relative overflow-visible transition-all">
                <CardContent className="flex flex-col gap-4 items-start">
                  <motion.div variants={iconVariants}>
                    <Image src="/Icon.png" alt="Scan" width={40} height={40} />
                  </motion.div>

                  <h3 className="font-heading font-semibold text-2xl leading-[30px] text-white">
                    Scan
                  </h3>

                  <p className="text-base leading-7 text-white">
                    Wisesama allows you to scan and analyze suspicious entities
                    including wallet addresses, websites, twitter handles, and
                    more to detect frauds and scams. Our machine learning
                    algorithms help to detect malicious wallet addresses in
                    real-time and provide a risk score for each address.
                  </p>

                  <Link
                    href="/check"
                    className="text-purple-400 font-medium flex items-center gap-1 group"
                  >
                    Learn more
                    <span className="group-hover:translate-x-1 transition-transform">
                      &rarr;
                    </span>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Report Card */}
          <motion.div
            variants={cardVariants}
            whileHover={{ scale: 1.04 }}
            className="w-full flex justify-center items-center min-h-[460px]"
          >
            <Card className="bg-[url('/card2.png')] bg-cover bg-center rounded-2xl p-10 min-h-[460px] w-full max-w-[400px] border-0 shadow-lg flex flex-col justify-between transition-all">
              <CardContent className="flex flex-col gap-6 items-start p-0">
                <motion.div variants={iconVariants}>
                  <Image src="/AlertIcon.png" alt="Report" width={40} height={40} />
                </motion.div>

                <h3 className="font-heading text-2xl font-bold text-white">
                  Report
                </h3>

                <p className="text-base leading-5 text-white">
                  If you come across a scam or a fraudulent entity, you can
                  report it on Wisesama. After reporting, the entity is
                  evaluated further by our automated algorithms or manual
                  screening and is then added to the Wisesama reports database.
                </p>

                <Link
                  href="/report"
                  className="text-purple-400 font-medium flex items-center gap-1 group"
                >
                  Learn more
                  <span className="group-hover:translate-x-1 transition-transform">
                    &rarr;
                  </span>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Alerts Card */}
          <motion.div
            variants={cardVariants}
            whileHover={{ scale: 1.04 }}
            className="w-full flex justify-center items-center min-h-[360px]"
          >
            <Card className="bg-[url('/card3.png')] bg-cover bg-center rounded-2xl p-10 min-h-[320px] w-full max-w-[480px] border-0 shadow-lg flex flex-col justify-between transition-all">
              <CardContent className="flex flex-col gap-6 items-start p-0">
                <motion.div variants={iconVariants}>
                  <Image src="/AlertIcon.png" alt="Alerts" width={40} height={40} />
                </motion.div>

                <h3 className="font-heading text-2xl font-bold text-white">
                  Alerts
                </h3>

                <p className="text-base leading-5 text-white">
                  Create an account, check the notification box and don&apos;t miss
                  the launch of our advanced alerts.
                </p>

                <Link
                  href="/report"
                  className="text-purple-400 font-medium flex items-center gap-1 group"
                >
                  Learn more
                  <span className="group-hover:translate-x-1 transition-transform">
                    &rarr;
                  </span>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* API Docs Card */}
          <div className="relative flex flex-col items-center justify-center min-h-[520px]">
            <motion.div
              variants={cardVariants}
              whileHover={{ scale: 1.04 }}
              className="w-full flex justify-center"
            >
              <Card className="bg-transparent border border-white rounded-2xl p-6 min-h-[420px] w-full max-w-[400px] relative overflow-visible flex flex-col justify-between transition-all">
                <CardContent className="flex flex-col gap-6 items-start p-0">
                  <motion.div variants={iconVariants}>
                    <Image src="/ApiIcon.png" alt="API" width={40} height={40} />
                  </motion.div>
                  <h3 className="font-heading text-2xl font-bold text-white">
                    API Docs
                  </h3>
                  <p className="text-base leading-5 text-white">
                    For developers, Wisesama provides a Search and Report API
                    that can be used to bake Wisesama capabilities into other
                    applications. The API allows you to scan and report
                    entities, and retrieve scam reports from the Wisesama
                    reports database. Check out our API documentation to learn
                    more.
                  </p>
                  <Link
                    href="/docs"
                    className="text-purple-400 font-medium flex items-center gap-1 group"
                  >
                    Learn more
                    <span className="group-hover:translate-x-1 transition-transform">
                      &rarr;
                    </span>
                  </Link>
                </CardContent>

                {/* Burst effect */}
                <motion.div
                  className="absolute -bottom-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                  style={{ width: 140, height: 140 }}
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 12,
                    ease: 'linear',
                  }}
                >
                  <Image src="/Star.png" alt="" width={140} height={140} />
                </motion.div>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
