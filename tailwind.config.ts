import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#182235",
        gridline: "#d5dde8",
        accent: "#0f766e",
        soft: "#f6f8fb",
      },
    },
  },
  plugins: [],
};

export default config;
