/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#ff5a1f', soft: 'rgba(255,90,31,0.12)' },
        brand2: '#f1c64f',
        ink: { DEFAULT: '#201813', 2: '#5f564f', 3: '#988d84' },
        bg: { 0: '#1d130f', 1: '#2b1b14' },
        paper: { DEFAULT: '#fbf6f1', 2: '#f4ece5' },
        card: { DEFAULT: 'rgba(255,255,255,0.82)', strong: 'rgba(255,255,255,0.94)' },
        line: { DEFAULT: 'rgba(32,24,19,0.10)', 2: 'rgba(32,24,19,0.06)' },
        source: {
          x: '#1DA1F2', reddit: '#FF4500', youtube: '#FF0000',
          bluesky: '#0085FF', mastodon: '#6364FF', hn: '#FF6600',
          google: '#4285F4', trends: '#34A853', serp: '#34A853',
          ads: '#FBBC04', meta: '#1877F2', tiktok: '#000000',
          site: '#6B7280',
        },
        danger: { DEFAULT: '#df4d43', soft: 'rgba(223,77,67,0.12)' },
        warning: { DEFAULT: '#ca8b16', soft: 'rgba(202,139,22,0.14)' },
        success: { DEFAULT: '#2b8e5c', soft: 'rgba(43,142,92,0.12)' },
        blue: { DEFAULT: '#4b7bf2', soft: 'rgba(75,123,242,0.12)' },
        plum: { DEFAULT: '#8b63e7', soft: 'rgba(139,99,231,0.12)' },
        dark: {
          bg: '#0f0b09', paper: '#1a1512', card: 'rgba(26,21,18,0.92)',
          ink: { DEFAULT: '#e8e0d8', 2: '#a8988e', 3: '#7a6e66' },
          line: 'rgba(232,224,216,0.10)',
        },
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        xs: '12px',
        sm: '16px',
        md: '20px',
        lg: '28px',
      },
      boxShadow: {
        xs: '0 4px 18px rgba(31,17,8,0.06)',
        sm: '0 10px 30px rgba(31,17,8,0.08)',
        md: '0 20px 60px rgba(31,17,8,0.12)',
      },
      width: {
        sidebar: '240px',
      },
      keyframes: {
        pulse: {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(0.82)', opacity: '0.6' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse 1.8s infinite',
        spin: 'spin 0.7s linear infinite',
        shimmer: 'shimmer 1.4s infinite',
        'fade-up': 'fadeUp 0.22s ease both',
      },
    },
  },
  plugins: [],
}
