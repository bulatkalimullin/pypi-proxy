import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["lab.webflare.ru"],
    proxy: {
      "/api": {
        target: "http://backend:8888",
        changeOrigin: true,
      },
      "/js-proxy": {
        target: "http://backend:8888",
        changeOrigin: true,
      },
    },
  },
});

