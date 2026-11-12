// Hono 上下文里挂载的变量。单独放一个文件，避免 middleware / routes / server 互相 import 成环。
export type AppEnv = {
  Variables: {
    userId: string;
    requestId: string;
  };
};
