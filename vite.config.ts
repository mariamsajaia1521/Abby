import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("leaflet")) return "maps";
          if (/\/(react|react-dom|scheduler)\//.test(id)) return "react";
        },
      },
    },
  },
});
