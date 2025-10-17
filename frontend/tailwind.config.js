/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ["Inter", "system-ui", "sans-serif"],
        },
        colors: {
          dark: {
            DEFAULT: "#0f1115",
            light: "#1a1d24",
          },
        },
        boxShadow: {
          card: "0 10px 40px -10px rgba(0,0,0,0.6)",
        },
      },
    },
    plugins: [],
  };