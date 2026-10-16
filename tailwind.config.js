/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        xplime: 'var(--xp-lime)',
        cyancustom: 'var(--cyan)',
        violetcustom: 'var(--violet)',
        ambercustom: 'var(--amber)',
        rosecustom: 'var(--rose)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 8px)',
        md: 'calc(var(--radius) - 4px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        heading: ['var(--font-heading)', 'sans-serif'],
        pixel: ['Silkscreen', 'monospace'],
      },
      boxShadow: {
        'glow-violet': '0 0 20px rgba(124, 92, 255, 0.25), 0 0 40px rgba(124, 92, 255, 0.1)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.2)',
        'glow-lime': '0 0 16px rgba(163, 230, 53, 0.2)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'fade-scale': 'fadeInScale 200ms ease forwards',
        'slide-up': 'slideUp 300ms ease forwards',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'streak-burn': 'streakBurn 1.5s ease-in-out infinite',
        'xp-flash': 'xpFlash 0.8s ease forwards',
        'shimmer': 'shimmer 1.8s infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};