import { ImageResponse } from 'next/og';
import { getFonts, SHARED_STYLES, OG_WIDTH, OG_HEIGHT, Logo } from '@/lib/og/utils';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get('title')?.slice(0, 100) || 'Risk Report';
    const description = searchParams.get('description')?.slice(0, 200) || 'Detailed risk assessment.';

    const address = rawTitle.replace('Risk Report: ', '');
    const truncatedAddress = address.length > 15
      ? `${address.slice(0, 12)}...${address.slice(-12)}`
      : address;

    const fonts = await getFonts();

    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', display: 'flex', ...SHARED_STYLES }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '60%', height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '0 72px' }}>
              <div style={{
                display: 'flex',
                fontSize: 56,
                fontWeight: 600,
                letterSpacing: '0',
                lineHeight: 1.15,
                marginBottom: 20,
                color: '#FFFFFF',
                fontFamily: '"Clash Display"',
              }}>
                {rawTitle}
              </div>
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 400, color: '#8B8B9E', lineHeight: 1.5, fontFamily: '"Satoshi"' }}>
                {description}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 72px 48px 72px' }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 12px #10B981' }} />
              <div style={{ display: 'flex', fontSize: 22, color: '#10B981', fontWeight: 600, fontFamily: '"Satoshi"' }}>Verified Risk Analysis</div>
              <div style={{ display: 'flex', width: 1, height: 20, backgroundColor: '#333', margin: '0 8px' }} />
              <div style={{ display: 'flex', fontSize: 22, color: '#555', fontFamily: '"Satoshi"' }}>wisesama.com</div>
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
                boxShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 80px rgba(16, 185, 129, 0.06)',
                justifyContent: 'space-between',
                gap: 16,
              }}>
                {/* Search Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                  <div style={{ display: 'flex', fontSize: 14, color: '#AAA', fontFamily: '"Satoshi"', letterSpacing: '0.02em' }}>{truncatedAddress}</div>
                </div>

                {/* Score */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0' }}>
                  <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, color: 'white', fontFamily: '"Clash Display"', letterSpacing: '-0.03em' }}>98%</div>
                  <div style={{ display: 'flex', fontSize: 16, color: '#8B8B9E', fontFamily: '"Satoshi"', marginTop: 4 }}>Safety Score</div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', height: 6, width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', height: '100%', width: '98%', backgroundColor: '#10B981', borderRadius: 3 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', fontSize: 12, color: '#10B981', fontFamily: '"Satoshi"', fontWeight: 600 }}>Low Risk</div>
                    <div style={{ display: 'flex', fontSize: 12, color: '#555', fontFamily: '"Satoshi"' }}>High Confidence</div>
                  </div>
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
