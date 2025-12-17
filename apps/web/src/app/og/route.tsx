import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // ?title=<title>
    const title = searchParams.get('title')?.slice(0, 100) || 'Wisesama';
    const description = searchParams.get('description')?.slice(0, 200) || 'Polkadot Fraud Detection';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0B0B11',
            // Deep purple glows in top-right and bottom-left to match landing page
            backgroundImage: `
              radial-gradient(circle at 100% 0%, rgba(113, 46, 255, 0.25) 0%, transparent 40%),
              radial-gradient(circle at 0% 100%, rgba(138, 16, 111, 0.2) 0%, transparent 40%)
            `,
            color: 'white',
            fontFamily: 'sans-serif',
            padding: '80px',
            position: 'relative',
          }}
        >
          {/* Grid Pattern Overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              zIndex: 0,
            }}
          />

          <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            
            {/* Header: Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg
                width="40"
                height="40"
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
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'white' }}>
                Wisesama
              </div>
            </div>

            {/* Main Content: Title & Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '85%' }}>
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
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
                    fontSize: 28,
                    fontWeight: 400,
                    color: '#A1A1AA',
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </div>
              )}
            </div>

            {/* Footer: Tagline & Visual Element */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#712EFF', fontSize: 20, fontWeight: 600 }}>Intelligent Risk Defense</span>
                <span style={{ color: '#52525B' }}>•</span>
                <span style={{ color: '#D4D4D8', fontSize: 20 }}>wisesama.com</span>
              </div>

              {/* Decorative Pill/Badge */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 20px', 
                backgroundColor: 'rgba(113, 46, 255, 0.1)', 
                border: '1px solid rgba(113, 46, 255, 0.2)', 
                borderRadius: '50px',
                color: '#D0AAFF',
                fontSize: 16,
                fontWeight: 600
              }}>
                Polkadot Ecosystem
              </div>
            </div>

          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
