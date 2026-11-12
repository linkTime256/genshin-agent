import { config } from "./config/env";
import { listen } from "./http/server";

listen(config.port);
