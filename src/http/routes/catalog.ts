import { Hono } from "hono";
import type {
  ArtifactDto,
  CharacterDetail,
  CharacterSummary,
  ListResponse,
  WeaponDto,
} from "../../../shared/contracts";
import * as catalog from "../../services/catalog.service";
import type { AppEnv } from "../env";

// 控制器只负责解析路径与格式化响应，业务规则都在 service 层。
export const catalogRoutes = new Hono<AppEnv>();

catalogRoutes.get("/characters", (c) => {
  const result = catalog.getCharacters();
  return c.json(result satisfies ListResponse<CharacterSummary>);
});

catalogRoutes.get("/characters/:name", (c) => {
  const detail = catalog.getCharacter(decodeURIComponent(c.req.param("name")));
  return c.json(detail satisfies CharacterDetail);
});

catalogRoutes.get("/weapons", (c) => {
  const result = catalog.getWeapons();
  return c.json(result satisfies ListResponse<WeaponDto>);
});

catalogRoutes.get("/artifacts", (c) => {
  const result = catalog.getArtifacts();
  return c.json(result satisfies ListResponse<ArtifactDto>);
});
