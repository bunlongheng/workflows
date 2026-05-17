import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-app': '#0f0f0f',
        'bg-panel': '#1a1a1a',
        'bg-card': '#141414',
        'text-primary': '#f0f0f0',
        'text-secondary': '#a8a8a8',
        'text-tertiary': '#666',
        'border-default': '#2a2a2a',
        'border-strong': '#333',
        'accent': '#6366f1',
        'accent-2': '#8b5cf6',
        'accent-3': '#a855f7',
      },
    },
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
    "bg-emerald-600",
    "bg-indigo-500",
    "bg-purple-500",
    "bg-cyan-600",
    "bg-amber-600",
  ],
};

export default config;
