// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          charts: ["recharts"],
          query: ["@tanstack/react-query"],
          crypto: ["crypto-js"],
          toast: ["react-hot-toast"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
