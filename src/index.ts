import { ensureDemoUser } from "./auth/demo-user";
import { config } from "./config/env";
import { listen } from "./http/server";

// 建表、seed 完成后再补默认用户，然后开始监听。
await ensureDemoUser();
listen(config.port);
