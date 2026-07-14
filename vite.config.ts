import { defineConfig } from "vite";

// base: "./" makes all asset URLs relative, which is what itch.io needs
// (the game is served from a subfolder, not the domain root).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
