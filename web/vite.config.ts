import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(webDir, "..");

export default defineConfig({
  root: webDir,
  publicDir: resolve(webDir, "public"),
  plugins: [react()],
  // 共享契约放在项目根的 shared/，开发服务器需要放行上一级目录。
  server: {
    // 固定端口与监听地址：本机 5173 常被其他项目占用，避免 Vite 悄悄换端口或绑到 IPv6。
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
    fs: { allow: [projectRoot] },
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/chats": "http://127.0.0.1:3000",
      "/messages": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
      "/ready": "http://127.0.0.1:3000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
