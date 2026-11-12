import { useMemo, useState } from "react";
import type { ArtifactDto, WeaponDto } from "../../../shared/contracts";
import { stars, weaponLabel } from "../constants";

type Props = {
  kind: "weapons" | "artifacts";
  weapons: WeaponDto[];
  artifacts: ArtifactDto[];
};

export default function CatalogLists({ kind, weapons, artifacts }: Props) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const weaponTypes = useMemo(
    () => Array.from(new Set(weapons.map((item) => item.type))).sort(),
    [weapons],
  );
  const filteredWeapons = useMemo(() => weapons.filter((item) => {
    if (search && !item.name.includes(search.trim())) return false;
    if (type !== "all" && item.type !== type) return false;
    return true;
  }), [weapons, search, type]);
  const filteredArtifacts = useMemo(
    () => artifacts.filter((item) => !search || item.name.includes(search.trim())),
    [artifacts, search],
  );

  if (kind === "weapons") {
    return (
      <>
        <div className="toolbar">
          <input
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索武器名…"
          />
          <span className="empty-hint">共 {filteredWeapons.length} / {weapons.length} 件武器</span>
        </div>
        <div className="filter-row">
          <button className={`chip ${type === "all" ? "active" : ""}`} onClick={() => setType("all")}>全部类型</button>
          {weaponTypes.map((code) => (
            <button key={code} className={`chip ${type === code ? "active" : ""}`} onClick={() => setType(code)}>
              {weaponLabel(code)}
            </button>
          ))}
        </div>
        <div className="card-grid">
          {filteredWeapons.length === 0 && <p className="empty-hint">没有匹配的武器。</p>}
          {filteredWeapons.map((item) => (
            <div key={item.name} className="item-card">
              <div className="item-title">{item.name}</div>
              <div className="item-sub">{weaponLabel(item.type)}</div>
              <div className="rank-stars" style={{ marginTop: 8 }}>{stars(item.rank)}</div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="toolbar">
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索圣遗物套装…"
        />
        <span className="empty-hint">共 {filteredArtifacts.length} / {artifacts.length} 套圣遗物</span>
      </div>
      <div className="list-grid">
        {filteredArtifacts.length === 0 && <p className="empty-hint">没有匹配的套装。</p>}
        {filteredArtifacts.map((item) => (
          <div key={item.name} className="item-card">
            <div className="item-title">◈ {item.name}</div>
            {item.effects.length > 0 ? (
              <ul className="effect-list">
                {item.effects.map((effect) => <li key={effect}>{effect}</li>)}
              </ul>
            ) : (
              <div className="item-sub" style={{ marginTop: 8 }}>暂无效果描述</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
