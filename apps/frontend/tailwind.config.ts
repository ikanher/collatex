import type { Config } from 'tailwindcss'

export default <Partial<Config>>({
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#eef3ff',100:'#dae5ff',200:'#b8ceff',300:'#90b2ff',
          400:'#6a93ff',500:'#3b75ff',600:'#2f5ddb',700:'#274ab1',
          800:'#213f8f',900:'#1e3776'
        },
        surface: { DEFAULT:'#ffffff', dark:'#0f1218', soft:'#f7f8fb' }
      },
      borderRadius: { xl:'0.75rem', '2xl':'1rem' },
      boxShadow: { soft:'0 1px 2px rgba(0,0,0,.06), 0 10px 20px -15px rgba(0,0,0,.2)' }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')]
})
