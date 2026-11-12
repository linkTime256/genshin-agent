import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 一条命令同时起后端和 Vite 开发服务器，零额外依赖。
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const options = { cwd: root, stdio: ["inherit", "inherit", "inherit"] as ["inherit", "inherit", "inherit"] };

const children = [
  Bun.spawn(["bun", "src/index.ts"], options),
  Bun.spawn(["bun", "run", "dev:web"], options),
];

let stopped = false;
function stop() {
  if (stopped) return;
  stopped = true;
  for (const child of children) child.kill();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.any(children.map((child) => child.exited));
stop();
