import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: "#FDF4F4",
          100: "#FCE7E7",
          200: "#F9D2D2",
          300: "#F3AAAA",
          400: "#E67575",
          500: "#CC3939",
          600: "#A81D1D",
          700: "#800000", // Primary PRD Maroon
          800: "#600000",
          900: "#4A0404", // Dark Crimson Accent
          950: "#2B0202",
        },
        surface: {
          50: "#F8FAFC", // Crisp neutral slate background
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          800: "#1E293B",
          900: "#0F172A",
        },
      },
      fontFamily: {
        sans: [
          "Montserrat",
          "var(--font-montserrat)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
        elevated: "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)",
        glow: "0 0 20px -3px rgba(128, 0, 0, 0.25)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-in": "slideIn 0.25s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
