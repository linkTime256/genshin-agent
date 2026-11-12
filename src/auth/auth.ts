import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { bearer } from "better-auth/plugins";
import { config } from "../config/env";
import { db } from "../db";
import { schema } from "../db/schema";

const secret = config.betterAuthSecret;

export const auth = betterAuth({
  secret,
  baseURL: config.betterAuthUrl,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true },
  plugins: [bearer()],
  databaseHooks: {
    session: {
      create: {
        after: async (row) => {
          console.log(`用户 ${row.userId} 登录`);
        },
      },
    },
  },
});
