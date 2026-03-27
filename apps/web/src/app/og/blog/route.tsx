import { ImageResponse } from 'next/og';
import { getFonts, SHARED_STYLES, OG_WIDTH, OG_HEIGHT, Logo } from '@/lib/og/utils';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title')?.slice(0, 100) || 'Blog';
    const description = searchParams.get('description')?.slice(0, 200) || 'Insights from Wisesama.';

    const fonts = await getFonts();

    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', display: 'flex', ...SHARED_STYLES }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '60%', height: '100%' }}>
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
              <div style={{ fontSize: 24, fontWeight: 400, color: '#8B8B9E', lineHeight: 1.5, fontFamily: '"Satoshi"' }}>
                {description}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 72px 48px 72px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D946EF', boxShadow: '0 0 12px #D946EF' }} />
              <div style={{ fontSize: 22, color: '#D946EF', fontWeight: 600, fontFamily: '"Satoshi"' }}>Latest Insights</div>
              <div style={{ width: 1, height: 20, backgroundColor: '#333', margin: '0 8px' }} />
              <div style={{ fontSize: 22, color: '#555', fontFamily: '"Satoshi"' }}>wisesama.com</div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '40%', height: '100%', padding: '48px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Logo />
            </div>

            <div style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                maxWidth: 380,
                backgroundColor: 'rgba(19, 19, 26, 0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 24,
                padding: 28,
                boxShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 80px rgba(217, 70, 239, 0.06)',
                gap: 20,
              }}>
                {/* Article Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(217, 70, 239, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D946EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 14, color: '#8B8B9E', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Satoshi"', fontWeight: 700 }}>Article</div>
                </div>

                {/* Content Lines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ height: 14, width: '90%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 7 }} />
                  <div style={{ height: 14, width: '70%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 7 }} />
                  <div style={{ height: 10, width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 5, marginTop: 8 }} />
                  <div style={{ height: 10, width: '85%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 5 }} />
                  <div style={{ height: 10, width: '92%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 5 }} />
                </div>

                {/* Read indicator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#D946EF' }} />
                    <div style={{ fontSize: 13, color: '#666', fontFamily: '"Satoshi"' }}>5 min read</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#444', fontFamily: '"Satoshi"' }}>wisesama.com/blog</div>
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
