import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(
  {
  plugins: [react()],
  base: "",
  server: {
    allowedHosts: [
      '90c4428a4ad4.ngrok-free.app',
    ]
  }
});