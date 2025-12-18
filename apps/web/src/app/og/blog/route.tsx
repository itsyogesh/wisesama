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
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D946EF', boxShadow: '0 0 10px #D946EF' }} />
              <div style={{ fontSize: 24, color: '#D946EF', fontWeight: 600, fontFamily: '"Satoshi"' }}>Latest Insights</div>
              <div style={{ width: 1, height: 20, backgroundColor: '#333', margin: '0 8px' }} />
              <div style={{ fontSize: 24, color: '#666', fontFamily: '"Satoshi"' }}>wisesama.com</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px', flex: 1, alignItems: 'flex-end' }}>
            <Logo />
            
            {/* Blog Card */}
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
                  <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(217, 70, 239, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F0ABFC', fontSize: 18 }}>📰</div>
                  <div style={{ fontSize: 14, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Satoshi"', fontWeight: 700 }}>Article</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ height: 12, width: '80%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6 }} />
                <div style={{ height: 8, width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
                <div style={{ height: 8, width: '90%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
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
