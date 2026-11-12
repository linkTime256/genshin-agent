import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  artifactRecommendations,
  artifacts,
  characters,
  weaponRecommendations,
  weapons,
} from "../db/schema";
import type { ArtifactDto, CharacterDetail, CharacterSummary, WeaponDto } from "../../shared/contracts";

function parseEffects(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

// 表很小，一次取全量再在内存里 join，避免按角色逐个查推荐造成 N+1。
export function listCharacters(): CharacterSummary[] {
  const rows = db.select().from(characters).orderBy(asc(characters.name)).all();
  const weaponCounts = new Map<string, number>();
  for (const row of db.select().from(weaponRecommendations).all()) {
    weaponCounts.set(row.characterName, (weaponCounts.get(row.characterName) ?? 0) + 1);
  }
  const artifactCounts = new Map<string, number>();
  for (const row of db.select().from(artifactRecommendations).all()) {
    artifactCounts.set(row.characterName, (artifactCounts.get(row.characterName) ?? 0) + 1);
  }
  return rows.map((row) => ({
    name: row.name,
    rank: row.rank,
    element: row.element,
    weaponType: row.weaponType,
    weaponCount: weaponCounts.get(row.name) ?? 0,
    artifactCount: artifactCounts.get(row.name) ?? 0,
  }));
}

export function findCharacter(name: string): CharacterDetail | null {
  const row = db.select().from(characters).where(eq(characters.name, name)).get();
  if (!row) return null;

  const weaponNames = db.select().from(weaponRecommendations)
    .where(eq(weaponRecommendations.characterName, name))
    .orderBy(asc(weaponRecommendations.id)).all().map((item) => item.weaponName);
  const artifactNames = db.select().from(artifactRecommendations)
    .where(eq(artifactRecommendations.characterName, name))
    .orderBy(asc(artifactRecommendations.id)).all().map((item) => item.setName);

  const weaponRows = weaponNames.length
    ? db.select().from(weapons).where(inArray(weapons.name, weaponNames)).all()
    : [];
  const artifactRows = artifactNames.length
    ? db.select().from(artifacts).where(inArray(artifacts.name, artifactNames)).all()
    : [];
  const weaponMap = new Map(weaponRows.map((item) => [item.name, item]));
  const artifactMap = new Map(artifactRows.map((item) => [item.name, item]));

  const weaponDtos: WeaponDto[] = weaponNames.map((weaponName) => {
    const weapon = weaponMap.get(weaponName);
    return { name: weaponName, rank: weapon?.rank ?? 0, type: weapon?.type ?? "" };
  });
  const artifactDtos: ArtifactDto[] = artifactNames.map((setName) => {
    const artifact = artifactMap.get(setName);
    return { name: setName, effects: artifact ? parseEffects(artifact.effects) : [] };
  });

  return {
    name: row.name,
    rank: row.rank,
    element: row.element,
    weaponType: row.weaponType,
    weaponCount: weaponDtos.length,
    artifactCount: artifactDtos.length,
    weapons: weaponDtos,
    artifacts: artifactDtos,
  };
}

export function listWeapons(): WeaponDto[] {
  return db.select().from(weapons).orderBy(desc(weapons.rank), asc(weapons.name)).all()
    .map((row) => ({ name: row.name, rank: row.rank, type: row.type }));
}

export function listArtifacts(): ArtifactDto[] {
  return db.select().from(artifacts).orderBy(asc(artifacts.name)).all()
    .map((row) => ({ name: row.name, effects: parseEffects(row.effects) }));
}
