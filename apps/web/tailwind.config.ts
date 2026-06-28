import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        mint: "#2fbf71",
        saffron: "#f2b84b",
        coral: "#e75a4f"
      },
      boxShadow: {
        soft: "0 16px 45px rgba(23, 33, 28, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
