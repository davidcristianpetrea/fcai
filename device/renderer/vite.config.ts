import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    outDir: "public",
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      formats: ["es"],
      fileName: () => "app.js",
    },
  },
  test: {
    environment: "node",
  },
});
