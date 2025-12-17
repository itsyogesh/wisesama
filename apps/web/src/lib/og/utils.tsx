export async function getFonts() {
  const bold = await fetch(new URL('../../../public/fonts/ClashDisplay-Bold.ttf', import.meta.url)).then((res) => res.arrayBuffer());
  const regular = await fetch(new URL('../../../public/fonts/ClashDisplay-Regular.ttf', import.meta.url)).then((res) => res.arrayBuffer());
  
  return [
    { name: 'Clash Display', data: bold, style: 'normal' as const, weight: 700 as const },
    { name: 'Clash Display', data: regular, style: 'normal' as const, weight: 400 as const },
  ];
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const SHARED_STYLES = {
  backgroundColor: '#0B0B11',
  backgroundImage: `
    radial-gradient(circle at 100% 0%, rgba(113, 46, 255, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 0% 100%, rgba(138, 16, 111, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)
  `,
  backgroundSize: '100% 100%, 100% 100%, 48px 48px',
  color: 'white',
  fontFamily: '"Clash Display"',
};

export const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#712EFF' }}>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: 'white' }}>Wisesama</div>
  </div>
);
