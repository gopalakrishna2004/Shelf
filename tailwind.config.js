/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        shelf: {
          dark: '#242321',        // Primary dark / charcoal
          surfaceDark: '#2D2B29', // Card / surface dark
          surfaceDarkElevated: '#353330', // Elevated dark surface
          borderDark: '#3A3834',  // Dark border
          borderDarkSubtle: '#32302D',
          ivory: '#F3F0E9',       // Warm ivory background
          surfaceLight: '#FFFFFF',// Card / surface light
          surfaceSubtle: '#FAF8F5',// Soft warm tint
          surfaceStone: '#ECE7DE', // Warmer layered surface
          stone: '#DCD7CD',       // Soft stone
          borderLight: '#E2DDD4', // Light border
          borderLightSubtle: '#ECE7DD',
          terracotta: '#C94B36',  // Terracotta accent
          terracottaHover: '#B53E2A',
          terracottaMuted: 'rgba(201, 75, 54, 0.12)',
          terracottaShadowLight: '#962D1D', // Distinct under-shelf for light mode
          terracottaShadowDark: '#751E11',  // Controlled under-shelf for dark mode
          muted: '#8C877D',       // Muted grey
          mutedDark: '#A09B90',
        }
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'btn': '12px',
        'btn-sm': '10px',
        'btn-lg': '14px',
        'card': '16px',
        'card-lg': '22px',
        'card-xl': '28px',
      },
      boxShadow: {
        'tactile-primary': '0 4px 0 #962D1D, 0 6px 18px rgba(201, 75, 54, 0.42)',
        'tactile-primary-hover': '0 5px 0 #962D1D, 0 8px 24px rgba(201, 75, 54, 0.50)',
        'tactile-primary-active': '0 1px 0 #962D1D, 0 2px 6px rgba(201, 75, 54, 0.28)',
        'tactile-primary-dark': '0 4px 0 #751E11, 0 6px 18px rgba(201, 75, 54, 0.32)',
        'tactile-primary-dark-hover': '0 5px 0 #751E11, 0 8px 24px rgba(201, 75, 54, 0.40)',
        'tactile-primary-dark-active': '0 1px 0 #751E11, 0 2px 6px rgba(201, 75, 54, 0.22)',
        'soft': '0 2px 8px -2px rgba(36, 35, 33, 0.04), 0 6px 20px -4px rgba(36, 35, 33, 0.05)',
        'soft-hover': '0 6px 16px -2px rgba(36, 35, 33, 0.06), 0 12px 32px -4px rgba(36, 35, 33, 0.08)',
        'soft-dark': '0 2px 8px -2px rgba(0, 0, 0, 0.2), 0 6px 20px -4px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
