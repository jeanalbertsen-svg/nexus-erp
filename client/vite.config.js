import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  },
  server: {
    host: true,        // allow access from LAN/WSL/Docker
    port: 5173,
    strictPort: true,  // fail if 5173 is taken
    open: true,        // auto-open browser
    proxy: {
      "/api": {
        target: "http://localhost:4000", // change to 4000 if your API runs there
        changeOrigin: true,
        secure: false
        // If your backend does NOT include the /api prefix, uncomment:
        // rewrite: (path) => path.replace(/^\/api/, "")
      },
      "/socket.io": {
        target: "http://localhost:4000", // match your API port
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true
  }
});

