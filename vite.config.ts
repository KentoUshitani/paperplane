import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    host: true, // phone on same Wi-Fi can open http://<LAN-IP>:5173
    open: false,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: "es2022",
  },
});
