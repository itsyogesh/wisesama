import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        wisesama: {
          bg: '#1A1A1A',
          dark: '#1A1A1A',
          'dark-secondary': '#2E2E2E',
          purple: {
            DEFAULT: '#712EFF',
            light: '#D0AAFF',
            dark: '#340062',
            accent: '#8C30FF',
            glow: '#45108A',
          },
          pink: {
            glow: '#8A106F',
          },
          lavender: '#D0BEFF',
          violet: '#6132DA',
          red: '#FF3939',
          status: {
            safe: '#83FF8F',
            fraud: '#FF3939',
            caution: '#FFA500',
          },
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
        heading: ['"Clash Display"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      letterSpacing: {
        'nav': '-0.5px',
      },
      backgroundImage: {
        // Nav item gradient text
        'nav-text': 'linear-gradient(276.7deg, #340062 -26.85%, #D0AAFF 178.46%)',
        // Button gradient (Join Us / Check Address)
        'btn-purple': 'linear-gradient(262.87deg, #712EFF -22.62%, rgba(101, 98, 255, 0) 160.73%)',
        // Info banner gradient
        'info-banner': 'linear-gradient(90.08deg, #D0BEFF -15.56%, #6132DA 67.64%)',
        // Hero fade (illustration to background)
        'hero-fade': 'linear-gradient(180deg, rgba(26, 26, 26, 0.13) 0%, #1A1A1A 100%)',
        // Section heading glow
        'section-glow': 'radial-gradient(81.9% 81.9% at 50% 50%, #45108A 0%, rgba(69, 16, 138, 0) 100%)',
        // Features section glow (pink variant)
        'features-glow': 'radial-gradient(81.9% 81.9% at 50% 50%, #8A106F 0%, rgba(69, 16, 138, 0) 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
