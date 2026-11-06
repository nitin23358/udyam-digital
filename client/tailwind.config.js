/** Design tokens for Udyam Digital. One accent (brand red), warm neutrals, three status hues. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: { 50: '#FFF2F2', 100: '#FFE1E1', 200: '#FFC4C4', 500: '#F01E1E', 600: '#E40000', 700: '#C00000', 800: '#9A0000' },
        ink: { DEFAULT: '#101014', 2: '#2E2E36', 3: '#5C5C68', 4: '#8B8B96' },
        line: { DEFAULT: '#E9E9EE', 2: '#F1F1F4' },
        canvas: '#F7F7F9',
        ok: { DEFAULT: '#0E7A4F', bg: '#E9F6EF', line: '#BFE5D0' },
        warn: { DEFAULT: '#A35A00', bg: '#FFF5E5', line: '#F6D9A8' },
        bad: { DEFAULT: '#C21D1D', bg: '#FDEDED', line: '#F5C2C2' },
        console: { bg: '#0E0F13', panel: '#16171C', line: '#24252C', text: '#C9CAD3' },
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,16,20,.04), 0 1px 1px rgba(16,16,20,.02)',
        lift: '0 8px 24px -8px rgba(16,16,20,.12), 0 2px 6px rgba(16,16,20,.04)',
        focus: '0 0 0 3px rgba(228,0,0,.16)',
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
        pulseDot: { '0%,100%': { opacity: 0.25 }, '50%': { opacity: 1 } },
        scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
      },
      animation: {
        rise: 'rise .35s cubic-bezier(.2,.7,.2,1) both',
        dot: 'pulseDot 1.2s ease-in-out infinite',
        scan: 'scan 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
