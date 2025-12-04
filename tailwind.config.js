/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./popup/**/*.{html,js}", "./content/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6', // Blue 500 (Translate button)
        secondary: '#f97316', // Orange 500 (Generate button)
        dark: '#09090b', // Zinc 950 (Main background)
        darker: '#000000', // Black
        surface: '#18181b', // Zinc 900 (Cards, Inputs)
        'surface-hover': '#27272a', // Zinc 800
        'text-muted': '#a1a1aa', // Zinc 400
      }
    },
  },
  plugins: [],
}
