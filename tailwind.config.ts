import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    "bg-red-500",
    "bg-purple-600",
    "bg-gray-800",
    "bg-green-500",
    "bg-blue-500",
    "bg-gray-700",
    "bg-sky-500",
    "bg-indigo-600",
    "bg-green-600",
    "bg-violet-600",
    "bg-yellow-500",
    "bg-blue-600",
    "bg-red-600",
    "bg-yellow-400",
    "bg-orange-500",
    "bg-gray-500",
    "bg-teal-600",
    "bg-sky-400",
  ],
};

export default config;
