/** Collapse agent-name variants (case, plurals, typos) into one canonical label. */

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Match key: lowercase, trim, strip trailing punctuation, singularize last word. */
export function agentMatchKey(name: string): string {
  let s = name
    .toLowerCase()
    .trim()
    .replace(/[.,]+$/g, '')
    .replace(/\s+/g, ' ');

  // Simple plural: "destinations" → "destination"
  s = s.replace(/\b([a-z]{4,})s\b/g, '$1');
  return s;
}

function isCompoundName(name: string): boolean {
  return /[-/|]/.test(name);
}

function maxEditDistance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 10) return 1;
  return 2;
}

export function agentsShouldMerge(a: string, b: string): boolean {
  if (a === b) return true;

  const ka = agentMatchKey(a);
  const kb = agentMatchKey(b);
  if (ka === kb) return true;

  // Keep "Sita" separate from "Sita - Govacation" / "Sita /Audley"
  if (isCompoundName(a) || isCompoundName(b)) {
    return ka === kb;
  }

  const wa = ka.split(' ');
  const wb = kb.split(' ');
  if (wa.length !== wb.length) return false;

  const dist = levenshtein(ka, kb);
  const maxLen = Math.max(ka.length, kb.length);
  return dist > 0 && dist <= maxEditDistance(maxLen) && dist / maxLen <= 0.25;
}

function pickCanonicalName(variants: Map<string, number>): string {
  const entries = [...variants.entries()];
  if (entries.length === 1) return entries[0][0];

  const maxCount = Math.max(...entries.map(([, c]) => c));
  // Include near-tied spellings so a frequent typo does not always win
  const contenders = entries.filter(([, c]) => c >= maxCount * 0.6);

  const centrality = (name: string) => {
    const key = agentMatchKey(name);
    const others = entries.map(([n]) => n).filter((n) => n !== name);
    if (!others.length) return 0;
    return others.reduce((s, n) => s + levenshtein(key, agentMatchKey(n)), 0) / others.length;
  };

  return contenders.sort((a, b) => {
    const ca = centrality(a[0]);
    const cb = centrality(b[0]);
    if (ca !== cb) return ca - cb;
    // Prefer shorter (typos often insert letters) when equally central
    if (a[0].length !== b[0].length) return a[0].length - b[0].length;
    if (b[1] !== a[1]) return b[1] - a[1];
    const aAllCaps = a[0] === a[0].toUpperCase() && /[A-Za-z]/.test(a[0]);
    const bAllCaps = b[0] === b[0].toUpperCase() && /[A-Za-z]/.test(b[0]);
    if (aAllCaps !== bAllCaps) return aAllCaps ? 1 : -1;
    const aLower = a[0][0] === a[0][0]?.toLowerCase();
    const bLower = b[0][0] === b[0][0]?.toLowerCase();
    if (aLower !== bLower) return aLower ? 1 : -1;
    return a[0].localeCompare(b[0]);
  })[0][0];
}

/**
 * Build rawName → canonical display name map.
 * Canonical name = most frequent spelling in the cluster (prefers mixed case over ALL CAPS).
 */
export function buildAgentCanonicalMap(names: string[]): Map<string, string> {
  const unique = [...new Set(names.filter(Boolean))];
  const parent = new Map<string, string>();
  for (const n of unique) parent.set(n, n);

  function find(x: string): string {
    const p = parent.get(x)!;
    if (p !== x) {
      const root = find(p);
      parent.set(x, root);
      return root;
    }
    return x;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  }

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (agentsShouldMerge(unique[i], unique[j])) {
        union(unique[i], unique[j]);
      }
    }
  }

  const clusters = new Map<string, Map<string, number>>();
  const counts = new Map<string, number>();
  for (const n of names) {
    if (!n) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }

  for (const n of unique) {
    const root = find(n);
    if (!clusters.has(root)) clusters.set(root, new Map());
    clusters.get(root)!.set(n, counts.get(n) ?? 0);
  }

  const result = new Map<string, string>();
  for (const [, variants] of clusters) {
    const canonical = pickCanonicalName(variants);
    for (const name of variants.keys()) {
      result.set(name, canonical);
    }
  }
  return result;
}

export function canonicalizeAgentName(name: string, map: Map<string, string>): string {
  return map.get(name) ?? name;
}
