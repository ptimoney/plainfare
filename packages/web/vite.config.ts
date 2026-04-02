import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src/ui",
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3141",
      "/recipes-images": "http://localhost:3141",
    },
  },
});
