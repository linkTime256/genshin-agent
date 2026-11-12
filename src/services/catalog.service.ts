import type { ArtifactDto, CharacterDetail, CharacterSummary, WeaponDto } from "../../shared/contracts";
import { badRequest, notFound } from "../domain/errors";
import * as repo from "../repositories/catalog.repo";

// 服务层只做编排与边界校验，不接触请求/响应对象，便于单测与复用。
function normalizeName(name: string): string {
  const value = name.trim();
  if (!value || value.length > 40) throw badRequest("角色名不合法");
  return value;
}

export function getCharacters(): { items: CharacterSummary[]; total: number } {
  const items = repo.listCharacters();
  return { items, total: items.length };
}

export function getCharacter(rawName: string): CharacterDetail {
  const name = normalizeName(rawName);
  const detail = repo.findCharacter(name);
  if (!detail) throw notFound(`没有找到角色：${name}`);
  return detail;
}

export function getWeapons(): { items: WeaponDto[]; total: number } {
  const items = repo.listWeapons();
  return { items, total: items.length };
}

export function getArtifacts(): { items: ArtifactDto[]; total: number } {
  const items = repo.listArtifacts();
  return { items, total: items.length };
}
