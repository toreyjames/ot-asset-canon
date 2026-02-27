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
        // OT Canon layer colors
        layer1: { DEFAULT: "#dc2626", light: "#fecaca" }, // Physical Process - Red
        layer2: { DEFAULT: "#ea580c", light: "#fed7aa" }, // Instrumentation - Orange
        layer3: { DEFAULT: "#ca8a04", light: "#fef08a" }, // Control Systems - Yellow
        layer4: { DEFAULT: "#16a34a", light: "#bbf7d0" }, // Operations - Green
        layer5: { DEFAULT: "#2563eb", light: "#bfdbfe" }, // Network - Blue
        layer6: { DEFAULT: "#7c3aed", light: "#ddd6fe" }, // Enterprise - Purple
        // Risk tiers
        critical: "#dc2626",
        high: "#ea580c",
        medium: "#ca8a04",
        low: "#16a34a",
      },
    },
  },
  plugins: [],
};

export default config;
