import type { Metadata } from 'next';
import Balancer from 'react-wrap-balancer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Wisesama',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="text-center mb-16">
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-white mb-6">
          <Balancer>Privacy Policy</Balancer>
        </h1>
        <p className="text-gray-400">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="bg-[#1F242F] border border-white/5 rounded-2xl p-8 md:p-12 shadow-2xl">
        <div className="prose prose-invert prose-lg max-w-none text-gray-300 space-y-8 leading-relaxed">
          <p>
            At Wisesama, accessible from https://wisesama.com, one of our main priorities is the privacy of our visitors.
            This Privacy Policy document contains types of information that is collected and recorded by Wisesama and how we use it.
          </p>
          
          <section className="space-y-4">
            <h2 className="font-heading text-2xl font-semibold text-white">Log Files</h2>
            <p>
              Wisesama follows a standard procedure of using log files. These files log visitors when they visit websites.
              All hosting companies do this and a part of hosting services&apos; analytics. The information collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users&apos; movement on the website, and gathering demographic information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-2xl font-semibold text-white">Cookies and Web Beacons</h2>
            <p>
              Like any other website, Wisesama uses &apos;cookies&apos;. These cookies are used to store information including visitors&apos; preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users&apos; experience by customizing our web page content based on visitors&apos; browser type and/or other information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-2xl font-semibold text-white">Consent</h2>
            <p>
              By using our website, you hereby consent to our Privacy Policy and agree to its Terms and Conditions.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
