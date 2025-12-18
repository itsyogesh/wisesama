import { ImageResponse } from 'next/og';
import { getFonts, SHARED_STYLES, OG_WIDTH, OG_HEIGHT, Logo } from '@/lib/og/utils';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title')?.slice(0, 100) || 'Wisesama';
    const description = searchParams.get('description')?.slice(0, 200) || 'Polkadot Fraud Detection';

    const fonts = await getFonts();

    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', display: 'flex', ...SHARED_STYLES }}>
          {/* Left: Content */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', maxWidth: '55%' }}>
            <div style={{
              fontSize: 80,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: 24,
              background: 'linear-gradient(90deg, #FFFFFF 0%, #A1A1AA 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              fontFamily: '"Clash Display"',
            }}>
              {title}
            </div>
            {description && (
              <div style={{
                fontSize: 32,
                fontWeight: 400,
                color: '#A1A1AA',
                lineHeight: 1.5,
                fontFamily: '"Satoshi"',
              }}>
                {description}
              </div>
            )}
            
            {/* Footer Tagline */}
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#712EFF', boxShadow: '0 0 10px #712EFF' }} />
              <div style={{ fontSize: 24, color: '#712EFF', fontWeight: 600, fontFamily: '"Satoshi"' }}>Intelligent Risk Defense</div>
              <div style={{ width: 1, height: 20, backgroundColor: '#333', margin: '0 8px' }} />
              <div style={{ fontSize: 24, color: '#666', fontFamily: '"Satoshi"' }}>wisesama.com</div>
            </div>
          </div>

          {/* Right: Logo & Illustration */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px', flex: 1, alignItems: 'flex-end' }}>
            <Logo />
            
            {/* Live Feed Card Illustration */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              width: 380,
              backgroundColor: 'rgba(19, 19, 26, 0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              marginTop: 'auto',
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(113, 46, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D0AAFF', fontSize: 18 }}>⚡</div>
                  <div style={{ fontSize: 14, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Satoshi"', fontWeight: 700 }}>Live Feed</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 8px #10B981' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 1 - (i * 0.25) }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: i === 1 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: i === 1 ? '#EF4444' : '#F59E0B' }}>
                      {i === 1 ? '!' : '?'}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ width: '60%', height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 }} />
                        <div style={{ width: '40%', height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
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