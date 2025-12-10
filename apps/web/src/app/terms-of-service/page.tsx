import type { Metadata } from 'next';
import Balancer from 'react-wrap-balancer';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Wisesama',
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="text-center mb-16">
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-white mb-6">
          <Balancer>Terms of Service</Balancer>
        </h1>
        <p className="text-gray-400">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="bg-[#1F242F] border border-white/5 rounded-2xl p-8 md:p-12 shadow-2xl">
        <div className="prose prose-invert prose-lg max-w-none text-gray-300 space-y-8 leading-relaxed">
          <section className="space-y-4">
            <h2 className="font-heading text-2xl font-semibold text-white">1. Terms</h2>
            <p>
              By accessing this Website, accessible from https://wisesama.com, you are agreeing to be bound by these Website Terms and Conditions of Use and agree that you are responsible for the agreement with any applicable local laws. If you disagree with any of these terms, you are prohibited from accessing this site. The materials contained in this Website are protected by copyright and trade mark law.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-2xl font-semibold text-white">2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials on Wisesama&apos;s Website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc pl-5 space-y-2 marker:text-wisesama-purple">
              <li>modify or copy the materials;</li>
              <li>use the materials for any commercial purpose or for any public display;</li>
              <li>attempt to reverse engineer any software contained on Wisesama&apos;s Website;</li>
              <li>remove any copyright or other proprietary notations from the materials; or</li>
              <li>transfer the materials to another person or &quot;mirror&quot; the materials on any other server.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-2xl font-semibold text-white">3. Disclaimer</h2>
            <p>
              All the materials on Wisesama&apos;s Website are provided &quot;as is&quot;. Wisesama makes no warranties, may it be expressed or implied, therefore negates all other warranties. Furthermore, Wisesama does not make any representations concerning the accuracy or likely reliability of the use of the materials on its Website or otherwise relating to such materials or on any sites linked to this Website.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-2xl font-semibold text-white">4. Limitations</h2>
            <p>
              Wisesama or its suppliers will not be hold accountable for any damages that will arise with the use or inability to use the materials on Wisesama&apos;s Website, even if Wisesama or an authorize representative of this Website has been notified, orally or written, of the possibility of such damage. Some jurisdiction does not allow limitations on implied warranties or limitations of liability for incidental damages, these limitations may not apply to you.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
