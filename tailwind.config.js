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
    extend: {
      // زيادة كل أحجام الخطوط في البرنامج بمقدار 2px إضافية (طلب صريح)
      fontSize: {
        xs:   ["14px", { lineHeight: "1.4" }],
        sm:   ["16px", { lineHeight: "1.45" }],
        base: ["18px", { lineHeight: "1.5"  }],
        lg:   ["20px", { lineHeight: "1.5"  }],
        xl:   ["22px", { lineHeight: "1.5"  }],
        "2xl": ["26px", { lineHeight: "1.4" }],
        "3xl": ["32px", { lineHeight: "1.3" }],
        "4xl": ["38px", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [],
};
