import { ImageResponse } from 'next/og';
import { getFonts, SHARED_STYLES, OG_WIDTH, OG_HEIGHT, Logo } from '@/lib/og/utils';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title')?.slice(0, 100) || 'Wisesama';
    const description = searchParams.get('description')?.slice(0, 200) || 'Detect fraud, verify identities, and protect your assets across the Polkadot and Kusama ecosystems.';

    const fonts = await getFonts();

    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', display: 'flex', ...SHARED_STYLES }}>
          {/* Left: Content */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '60%', height: '100%' }}>
            {/* Centered content */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '0 72px' }}>
              <div style={{
                fontSize: 56,
                fontWeight: 600,
                letterSpacing: '0',
                lineHeight: 1.15,
                marginBottom: 20,
                color: '#FFFFFF',
                fontFamily: '"Clash Display"',
              }}>
                {title}
              </div>
              {description && (
                <div style={{
                  fontSize: 26,
                  fontWeight: 400,
                  color: '#8B8B9E',
                  lineHeight: 1.5,
                  fontFamily: '"Satoshi"',
                }}>
                  {description}
                </div>
              )}
            </div>

            {/* Footer — pinned to bottom */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 72px 48px 72px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#712EFF', boxShadow: '0 0 12px #712EFF' }} />
              <div style={{ fontSize: 22, color: '#712EFF', fontWeight: 600, fontFamily: '"Satoshi"' }}>Intelligent Risk Defense</div>
              <div style={{ width: 1, height: 20, backgroundColor: '#333', margin: '0 8px' }} />
              <div style={{ fontSize: 22, color: '#555', fontFamily: '"Satoshi"' }}>wisesama.com</div>
            </div>
          </div>

          {/* Right: Logo & Illustration — both centered */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '40%', height: '100%', padding: '48px' }}>
            {/* Logo top-right */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Logo />
            </div>

            {/* Illustration centered */}
            <div style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 320,
                height: 340,
                backgroundColor: 'rgba(19, 19, 26, 0.9)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 24,
                padding: 32,
                boxShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 80px rgba(113, 46, 255, 0.08)',
              }}>
                {/* Shield Icon */}
                <svg width="72" height="72" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 24 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#712EFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="rgba(113, 46, 255, 0.1)" />
                  <path d="M9 12l2 2 4-4" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>

                {/* Status Lines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                  {[
                    { label: 'Identity', color: '#10B981', width: '85%' },
                    { label: 'Blacklist', color: '#712EFF', width: '92%' },
                    { label: 'Risk Score', color: '#F59E0B', width: '70%' },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 14, color: '#666', fontFamily: '"Satoshi"' }}>{item.label}</div>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: item.color }} />
                      </div>
                      <div style={{ display: 'flex', height: 4, width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', height: '100%', width: item.width, backgroundColor: item.color, borderRadius: 2, opacity: 0.6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      { width: OG_WIDTH, height: OG_HEIGHT, fonts }
    );
  } catch (e) {
    return new Response(`Failed to generate the image`, { status: 500 });
  }
}
