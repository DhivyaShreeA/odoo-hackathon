/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#1B2430", // sidebar / dark surfaces
        canvas: "#F5F6F8", // page background
        surface: "#FFFFFF", // cards
        border: "#E3E6EA",
        primary: {
          DEFAULT: "#35507A", // muted industrial blue — primary actions
          dark: "#263A59",
        },
        accent: "#D98E04", // warehouse-amber — low stock / warnings
        good: "#2F6F4E", // stock increases / success
        danger: "#B3402A", // stock decreases / errors
        muted: "#6B7280",
      },
    },
  },
  plugins: [],
};
