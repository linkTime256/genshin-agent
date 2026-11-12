import { useEffect, useMemo, useState } from "react";
import type { CharacterDetail, CharacterSummary } from "../../../shared/contracts";
import { api } from "../api/client";
import { ELEMENT_OPTIONS, elementColor, elementLabel, stars, weaponLabel } from "../constants";

type Props = {
  characters: CharacterSummary[];
  selected: string | null;
  onSelect: (name: string) => void;
  onAsk: (name: string) => void;
  onOpenWeapons: () => void;
  onOpenArtifacts: () => void;
};

export default function CharacterGallery({
  characters,
  selected,
  onSelect,
  onAsk,
  onOpenWeapons,
  onOpenArtifacts,
}: Props) {
  const [search, setSearch] = useState("");
  const [element, setElement] = useState("all");
  const [rank, setRank] = useState("all");
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setDetailError(null);
    api.character(selected)
      .then((result) => { if (alive) setDetail(result); })
      .catch((err) => { if (alive) setDetailError(err instanceof Error ? err.message : "角色详情加载失败"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selected]);

  const filtered = useMemo(() => characters.filter((item) => {
    if (search && !item.name.includes(search.trim())) return false;
    if (element !== "all" && item.element !== element) return false;
    if (rank !== "all" && item.rank !== Number(rank)) return false;
    return true;
  }), [characters, search, element, rank]);

  return (
    <>
      <div className="toolbar">
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索角色名…"
        />
        <select className="select-input" value={rank} onChange={(e) => setRank(e.target.value)}>
          <option value="all">全部星级</option>
          <option value="5">五星</option>
          <option value="4">四星</option>
        </select>
        <span className="empty-hint">共 {filtered.length} / {characters.length} 位角色</span>
      </div>

      <div className="filter-row">
        <button className={`chip ${element === "all" ? "active" : ""}`} onClick={() => setElement("all")}>全部元素</button>
        {ELEMENT_OPTIONS.map((option) => (
          <button
            key={option.code}
            className={`chip ${element === option.code ? "active" : ""}`}
            onClick={() => setElement(option.code)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="gallery-layout">
        <div className="card-grid">
          {filtered.length === 0 && <p className="empty-hint">没有匹配的角色，换个条件试试。</p>}
          {filtered.map((item) => (
            <button
              key={item.name}
              className={`character-card ${selected === item.name ? "selected" : ""}`}
              onClick={() => onSelect(item.name)}
            >
              <div
                className="character-avatar"
                style={{ background: `linear-gradient(135deg, ${elementColor(item.element)}, ${elementColor(item.element)}bb)` }}
              >
                {item.name.slice(0, 1)}
              </div>
              <div className="character-name">{item.name}</div>
              <div className="character-meta">{weaponLabel(item.weaponType)} · {item.weaponCount} 把武器 · {item.artifactCount} 套圣遗物</div>
              <div className="card-tags">
                <span className="element-badge" style={{ background: elementColor(item.element) }}>
                  {elementLabel(item.element)}
                </span>
                <span className="rank-stars">{stars(item.rank)}</span>
              </div>
            </button>
          ))}
        </div>

        <aside className="detail-panel">
          {!selected && <p className="detail-empty">从左边点一个角色，查看基础资料与推荐装备。</p>}
          {loading && <p className="detail-empty">加载中…</p>}
          {detailError && <p className="form-error">{detailError}</p>}
          {detail && !loading && (
            <>
              <div className="detail-header">
                <div className="detail-avatar" style={{ background: elementColor(detail.element) }}>
                  {detail.name.slice(0, 1)}
                </div>
                <div>
                  <div className="detail-title">{detail.name}</div>
                  <div className="detail-sub">
                    <span className="rank-stars">{stars(detail.rank)}</span> · {elementLabel(detail.element)}元素 · {weaponLabel(detail.weaponType)}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>基础资料</h4>
                <div className="tag-list">
                  <span className="tag">星级 {detail.rank || "—"}</span>
                  <span className="tag">元素 {elementLabel(detail.element)}</span>
                  <span className="tag">武器 {weaponLabel(detail.weaponType)}</span>
                </div>
              </div>

              <div className="detail-section">
                <h4>推荐武器 <button className="link-button" onClick={onOpenWeapons}>查看武器目录 →</button></h4>
                {detail.weapons.length > 0 ? (
                  <div className="tag-list">
                    {detail.weapons.map((weapon) => (
                      <button key={weapon.name} className="tag clickable" onClick={onOpenWeapons}>
                        {weapon.name} <span className="rank-stars">{stars(weapon.rank)}</span>
                      </button>
                    ))}
                  </div>
                ) : <p className="detail-empty">暂无推荐记录</p>}
              </div>

              <div className="detail-section">
                <h4>推荐圣遗物 <button className="link-button" onClick={onOpenArtifacts}>查看套装效果 →</button></h4>
                {detail.artifacts.length > 0 ? detail.artifacts.map((artifact) => (
                  <div key={artifact.name} style={{ marginBottom: 12 }}>
                    <button className="tag clickable" onClick={onOpenArtifacts}>{artifact.name}</button>
                    {artifact.effects.length > 0 && (
                      <ul className="effect-list">
                        {artifact.effects.map((effect) => <li key={effect}>{effect}</li>)}
                      </ul>
                    )}
                  </div>
                )) : <p className="detail-empty">暂无推荐记录</p>}
              </div>

              <button className="primary-button" style={{ width: "100%", marginTop: 18 }} onClick={() => onAsk(detail.name)}>
                💬 问一下助手：{detail.name}怎么配装
              </button>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
