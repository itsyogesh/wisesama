import { ImageResponse } from 'next/og';
import { getFonts, SHARED_STYLES, OG_WIDTH, OG_HEIGHT, Logo } from '@/lib/og/utils';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title')?.slice(0, 100) || 'Risk Report';
    const description = searchParams.get('description')?.slice(0, 200) || 'Detailed risk assessment.';

    const fonts = await getFonts();

    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', display: 'flex', ...SHARED_STYLES }}>
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
            <div style={{ fontSize: 32, fontWeight: 400, color: '#A1A1AA', lineHeight: 1.5, fontFamily: '"Satoshi"' }}>
              {description}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 10px #10B981' }} />
              <div style={{ fontSize: 24, color: '#10B981', fontWeight: 600, fontFamily: '"Satoshi"' }}>Verified Risk Analysis</div>
              <div style={{ width: 1, height: 20, backgroundColor: '#333', margin: '0 8px' }} />
              <div style={{ fontSize: 24, color: '#666', fontFamily: '"Satoshi"' }}>wisesama.com</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px', flex: 1, alignItems: 'flex-end' }}>
            <Logo />
            
            {/* Risk Score Card */}
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
                  <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                    {/* Replaced Emoji with SVG */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 14, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Satoshi"', fontWeight: 700 }}>Report</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 64, fontWeight: 700, color: 'white', fontFamily: '"Clash Display"' }}>98%</div>
                <div style={{ fontSize: 16, color: '#A1A1AA', fontFamily: '"Satoshi"' }}>Safety Score</div>
              </div>
              <div style={{ height: 6, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginTop: 10, display: 'flex' }}>
                <div style={{ height: '100%', width: '98%', backgroundColor: '#10B981' }} />
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
