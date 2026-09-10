/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
    "node_modules/flowbite-react/lib/esm/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        aspire: {
          blue: '#3C64A3',
          lightBlue: '#4D76B2',
          teal: '#008C96',
          cyan: '#0BB7D6',
          yellow: '#FED56D',
          mustard: '#F5C75D',
          gold: '#EEB141',
          black: '#1D1D1B',
          gray: '#333333',
          bg: '#F8FAFC',
          errorRed: '#E11D48'
        },
      },
    },
  },
  plugins: [require('flowbite/plugin')],
};