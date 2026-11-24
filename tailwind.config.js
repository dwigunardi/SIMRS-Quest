/**
 * Warna landing (Beranda) berawalan `q`: nilainya variabel CSS "R G B" yang ditukar lewat html[data-theme]
 * (src/platform/landing/styles/tokens.css), jadi alpha tetap bisa dipakai: bg-q-primary/20.
 */
const q = (name) => `rgb(var(--q-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Landing: Varela Round = teks, Orbitron = judul display.
        'q-body': ['"Varela Round"', 'ui-rounded', '"Segoe UI"', 'system-ui', 'sans-serif'],
        'q-display': ['Orbitron', '"Varela Round"', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      colors: {
        q: {
          bg: q('bg'),
          surface: q('surface'),
          muted: q('muted'),
          tint: q('tint'),
          band: q('band'),
          footer: q('footer'),
          border: q('border'),
          'border-strong': q('border-strong'),
          ink: q('ink'),
          'ink-soft': q('ink-soft'),
          'band-ink': q('band-ink'),
          'band-soft': q('band-soft'),
          primary: q('primary'),
          'primary-hover': q('primary-hover'),
          'primary-shadow': q('primary-shadow'),
          'on-primary': q('on-primary'),
          'primary-ink': q('primary-ink'),
          brand: q('brand'),
          'brand-ink': q('brand-ink'),
          amber: q('amber'),
          'amber-ink': q('amber-ink'),
          'amber-soft': q('amber-soft'),
          'on-amber': q('on-amber'),
          coral: q('coral'),
          'coral-strong': q('coral-strong'),
          'coral-ink': q('coral-ink'),
          'coral-soft': q('coral-soft'),
          'on-coral': q('on-coral'),
          success: q('success'),
          'success-ink': q('success-ink'),
          'success-soft': q('success-soft'),
          'on-success': q('on-success'),
          focus: q('focus'),
          'mascot-line': q('mascot-line'),
          'code-bg': q('code-bg'),
          'code-deep': q('code-deep'),
          'code-chrome': q('code-chrome'),
          'code-border': q('code-border'),
          'code-ink': q('code-ink'),
          'code-muted': q('code-muted'),
          'emoji-base': q('emoji-base'),
        },
      },
      borderRadius: {
        q: '12px', // kontrol & kartu
        'q-lg': '24px', // kartu besar & mockup
        'q-pill': '999px',
      },
      boxShadow: {
        'q-float': 'var(--q-shadow-float)',
        'q-pop': 'var(--q-shadow-pop)',
      },
      maxWidth: {
        'q-content': '1240px',
      },
      spacing: {
        'q-nav': '60px', // tinggi navbar
        'q-gutter': '20px', // padding samping
        'q-section': '96px', // jarak antar-section
        'q-section-lg': '120px',
      },
      fontSize: {
        'q-hero': ['40px', { lineHeight: '1.1' }],
        'q-hero-lg': ['56px', { lineHeight: '1.08' }],
        'q-h2': ['44px', { lineHeight: '1.15' }],
        'q-h2-sm': ['32px', { lineHeight: '1.2' }],
        'q-h3': ['22px', { lineHeight: '1.3' }],
      },
      screens: {
        // Lebar konten penuh landing (640 = sm dan 1024 = lg sudah bawaan Tailwind).
        wide: '1240px',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-40px)', opacity: '0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        // Landing: isi accordion (tinggi dari variabel Radix) dan panel menu.
        'q-accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'q-accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'q-menu-in': {
          from: { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'q-menu-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.45s ease-out both',
        'float-up': 'float-up 1.2s ease-out forwards',
        shake: 'shake 0.4s ease-in-out',
        'q-accordion-down': 'q-accordion-down 0.25s ease-out',
        'q-accordion-up': 'q-accordion-up 0.2s ease-out',
        'q-menu-in': 'q-menu-in 0.16s ease-out',
        'q-menu-out': 'q-menu-out 0.12s ease-in forwards',
      },
    },
  },
  plugins: [],
};
