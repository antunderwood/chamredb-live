module.exports = {
  mode: 'jit',
  purge: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    extend: {
      boxShadow: {
        white: '0 10px 15px -3px rgba(255,255,255,0.37),0 4px 6px -2px rgba(255,255,255,0.37)',
      },
      colors: {
        cgps: {
          dpurple: '#673c90',
          lpurple: '#a386bd',
          green: '#3c7383',
          pink: '#ac65a6',
        },
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
