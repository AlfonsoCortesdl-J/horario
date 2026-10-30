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
        coverage: {
          empty: "#9ca3af",      // Gris (0 personas)
          violation: "#ef4444",  // Rojo (1 persona - violación regla de 2)
          covered: "#10b981",    // Verde (2+ personas)
        },
      },
    },
  },
  plugins: [],
};
export default config;
