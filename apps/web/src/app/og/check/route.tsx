import { ImageResponse } from 'next/og';
import { getFonts, SHARED_STYLES, OG_WIDTH, OG_HEIGHT, Logo } from '@/lib/og/utils';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get('title')?.slice(0, 100) || 'Risk Report';
    const description = searchParams.get('description')?.slice(0, 200) || 'Detailed risk assessment.';

    // Extract address from title "Risk Report: <ADDRESS>"
    const address = rawTitle.replace('Risk Report: ', '');
    const truncatedAddress = address.length > 15 
      ? `${address.slice(0, 12)}...${address.slice(-12)}`
      : address;

    const fonts = await getFonts();

    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', display: 'flex', ...SHARED_STYLES }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', maxWidth: '55%' }}>
            <div style={{
              display: 'flex', // Added flex
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: 24,
              background: 'linear-gradient(90deg, #FFFFFF 0%, #A1A1AA 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              fontFamily: '"Clash Display"',
            }}>
              {rawTitle}
            </div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 400, color: '#A1A1AA', lineHeight: 1.5, fontFamily: '"Satoshi"' }}>
              {description}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 10px #10B981' }} />
              <div style={{ display: 'flex', fontSize: 24, color: '#10B981', fontWeight: 600, fontFamily: '"Satoshi"' }}>Verified Risk Analysis</div>
              <div style={{ display: 'flex', width: 1, height: 20, backgroundColor: '#333', margin: '0 8px' }} />
              <div style={{ display: 'flex', fontSize: 24, color: '#666', fontFamily: '"Satoshi"' }}>wisesama.com</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px', flex: 1, alignItems: 'flex-end' }}>
            <Logo />
            
            {/* Risk Score Card */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              width: 420,
              height: 400,
              backgroundColor: 'rgba(19, 19, 26, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: 32,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              marginTop: 'auto',
              marginBottom: 20,
              justifyContent: 'space-between'
            }}>
              {/* Mock Search Bar */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 24
              }}>
                <div style={{ display: 'flex' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <div style={{ display: 'flex', fontSize: 20, color: '#FFF', fontFamily: '"Satoshi"', letterSpacing: '0.05em' }}>{truncatedAddress}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', flex: 1, justifyContent: 'center' }}>
                <div style={{ display: 'flex', fontSize: 80, fontWeight: 700, color: 'white', fontFamily: '"Clash Display"' }}>98%</div>
                <div style={{ display: 'flex', fontSize: 20, color: '#A1A1AA', fontFamily: '"Satoshi"' }}>Safety Score</div>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <div style={{ display: 'flex', height: 6, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', height: '100%', width: '98%', backgroundColor: '#10B981' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                   <div style={{ display: 'flex', fontSize: 14, color: '#10B981', fontFamily: '"Satoshi"', fontWeight: 600 }}>Low Risk</div>
                   <div style={{ display: 'flex', fontSize: 14, color: '#666', fontFamily: '"Satoshi"' }}>High Confidence</div>
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
