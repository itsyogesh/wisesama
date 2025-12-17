import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // ?title=<title>
    const title = searchParams.get('title')?.slice(0, 100) || 'Wisesama';
    const description = searchParams.get('description')?.slice(0, 200) || 'Polkadot Fraud Detection';

    // Font loading
    const clashBoldData = await fetch(new URL('../../../public/fonts/ClashDisplay-Bold.ttf', import.meta.url)).then((res) => res.arrayBuffer());
    const clashRegularData = await fetch(new URL('../../../public/fonts/ClashDisplay-Regular.ttf', import.meta.url)).then((res) => res.arrayBuffer());

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#0B0B11',
            backgroundImage: `
              radial-gradient(circle at 100% 0%, rgba(113, 46, 255, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 0% 100%, rgba(138, 16, 111, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)
            `,
            backgroundSize: '100% 100%, 100% 100%, 48px 48px',
            color: 'white',
            fontFamily: '"Clash Display"',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', maxWidth: '60%' }}>
            <div
              style={{
                fontSize: 80,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                marginBottom: 24,
                background: 'linear-gradient(90deg, #FFFFFF 0%, #A1A1AA 100%)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {title}
            </div>
            {description && (
              <div
                style={{
                  fontSize: 32,
                  fontFamily: '"Clash Display"',
                  fontWeight: 400,
                  color: '#A1A1AA',
                  lineHeight: 1.5,
                }}
              >
                {description}
              </div>
            )}
            <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#712EFF', boxShadow: '0 0 10px #712EFF' }} />
              <div style={{ fontSize: 24, color: '#712EFF', fontWeight: 600 }}>Intelligent Risk Defense</div>
            </div>
          </div>

          {/* Right Side: Logo & Illustration */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px', flex: 1, alignItems: 'flex-end' }}>
            
            {/* Logo Top Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: '#712EFF' }}
              >
                <path
                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 16V12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 8H12.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: 'white' }}>
                Wisesama
              </div>
            </div>

            {/* Illustration Card */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              width: 320,
              backgroundColor: 'rgba(19, 19, 26, 0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              marginTop: 'auto',
              marginBottom: 40
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(113, 46, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D0AAFF' }}>⚡</div>
                  <div style={{ fontSize: 14, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Feed</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 8px #10B981' }} />
              </div>
              
              {/* Mock List Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 1 - (i * 0.25) }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: i === 1 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {i === 1 ? '!' : '?'}
                    </div>
                    <div style={{ flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 }} />
                    <div style={{ width: 40, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Clash Display',
            data: clashBoldData,
            style: 'normal',
            weight: 700,
          },
          {
            name: 'Clash Display',
            data: clashRegularData,
            style: 'normal',
            weight: 400,
          },
        ],
      }
    );
  } catch (e) {
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
