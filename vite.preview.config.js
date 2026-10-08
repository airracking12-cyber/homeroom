// Local preview with a fake database, for looking at the UI without Supabase: npx vite --config vite.preview.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [{ find: /^\.\/supabaseClient(\.js)?$/, replacement: path.resolve("preview/mockSupabase.js") }] },
});
