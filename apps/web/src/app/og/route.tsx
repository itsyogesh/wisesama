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
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0B0B11',
            backgroundImage: 'radial-gradient(circle at 25px 25px, #2a2a2a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #2a2a2a 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            color: 'white',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Logo / Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 40,
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: '#712EFF', marginRight: 16 }}
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
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>Wisesama</span>
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              textAlign: 'center',
              fontSize: 60,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              marginBottom: 20,
              padding: '0 60px',
              background: 'linear-gradient(90deg, #fff, #a5a5a5)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {title}
          </div>

          {/* Description */}
          {description && (
            <div
              style={{
                display: 'flex',
                textAlign: 'center',
                fontSize: 24,
                color: '#888',
                padding: '0 80px',
                lineHeight: 1.5,
              }}
            >
              {description}
            </div>
          )}

          {/* Footer Decoration */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 18,
              color: '#555',
            }}
          >
            <span>wisesama.com</span>
            <span style={{ margin: '0 10px' }}>•</span>
            <span>Intelligent Risk Defense</span>
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
