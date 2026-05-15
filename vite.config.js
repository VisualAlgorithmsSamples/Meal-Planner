import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/data": {
        target: "https://localhost:3001",
        secure: false,
      },
    },
  },
});
