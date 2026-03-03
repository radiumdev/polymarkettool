import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: {
      bg: { 1:"#06070b", 2:"#0c0d13", 3:"#12131b", 4:"#181924", 5:"#1e1f2e" },
      edge: { 1:"#1f2033", 2:"#2d2e45" },
      mint: { DEFAULT:"#00d4aa", dim:"#00d4aa20" },
      coral: { DEFAULT:"#ff4757", dim:"#ff475720" },
      iris: { DEFAULT:"#818cf8", dim:"#818cf820" },
      amber: { DEFAULT:"#ffc107", dim:"#ffc10720" },
      sky: { DEFAULT:"#38bdf8", dim:"#38bdf820" },
    },
    fontFamily: { sans:['"IBM Plex Sans"',"system-ui","sans-serif"], mono:['"JetBrains Mono"',"monospace"] },
  }}, plugins: [],
};
export default config;
