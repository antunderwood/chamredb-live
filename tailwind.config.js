module.exports = {
  mode: 'jit',
  purge: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    extend: {
      boxShadow: {
        white: '0 10px 15px -3px rgba(255,255,255,0.37),0 4px 6px -2px rgba(255,255,255,0.37)',
      },
    },
  },
  variants: {
    extend: {
      ringColor: ['hover'],
      ringOffsetColor: ['hover'],
      outline: ['hover'],
    },
  },
  plugins: [],
}
