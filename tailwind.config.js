/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./App.jsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./constants/**/*.{js,ts}",
    "./utils/**/*.{js,ts}",
    "./data/**/*.{js,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
