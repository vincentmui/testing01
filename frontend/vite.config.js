import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// UI_PORT / API_URL (see start.sh) let this app run next to other dev servers. /api/* is proxied (not /api-docs, which is a page)
// to the FastAPI server, so the browser never needs CORS.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: Number(process.env.UI_PORT) || 5180, strictPort: true, proxy: { "^/api/": process.env.API_URL || "http://localhost:8010" } },
});
