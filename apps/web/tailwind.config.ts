import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        studio: {
          950: "#0a0a0b",
          900: "#101012",
          850: "#16161a",
          800: "#1d1d22",
          700: "#2a2a31",
        },
        accent: { DEFAULT: "#fbbf24", soft: "#fcd34d", deep: "#f59e0b" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: { "2xs": ["10px", "14px"] },
    },
  },
  plugins: [],
};

export default config;
