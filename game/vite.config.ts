import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5280
  },
  preview: {
    host: "127.0.0.1",
    port: 5281
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"]
        }
      }
    }
  }
});
