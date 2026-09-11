// Conversions CSV / JSON / tableur côté navigateur.

/** CSV → tableur : génère un fichier .xls (table HTML) ouvrable dans Excel. */
export function csvToExcelHtml(csv: string): { url: string; name: string } {
  const rows = parseCsv(csv);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>` +
    `<table border="1">` +
    rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("") +
    `</table></body></html>`;
  return {
    url: URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" })),
    name: "converted.xls",
  };
}

/** JSON (tableau d'objets) → CSV. */
export function jsonToCsv(jsonText: string): { url: string; name: string } {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("JSON invalide.");
  }
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object") {
    throw new Error("Le JSON doit être un tableau d'objets non vide.");
  }
  const records = data as Record<string, unknown>[];
  const columns = [...new Set(records.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    columns.join(","),
    ...records.map((r) => columns.map((c) => esc(r[c])).join(",")),
  ];
  return {
    url: URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" })),
    name: "converted.csv",
  };
}

/** XML → JSON (objets simples, via DOMParser navigateur). */
export function xmlToJson(xmlText: string): { url: string; name: string } {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML invalide.");
  const obj = xmlNodeToObject(doc.documentElement);
  return {
    url: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })),
    name: "converted.json",
  };
}

function xmlNodeToObject(el: Element): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const attr of Array.from(el.attributes)) obj["@" + attr.name] = attr.value;
  const childEls = Array.from(el.children);
  if (childEls.length === 0) {
    const text = el.textContent?.trim() ?? "";
    if (Object.keys(obj).length === 0) return { value: text };
    obj.value = text;
    return obj;
  }
  for (const child of childEls) {
    const val = xmlNodeToObject(child);
    if (child.tagName in obj) {
      const existing = obj[child.tagName];
      if (Array.isArray(existing)) (existing as unknown[]).push(val);
      else obj[child.tagName] = [existing, val];
    } else obj[child.tagName] = val;
  }
  return obj;
}

/** XML (tableau d'éléments répétés) → CSV. */
export function xmlToCsv(xmlText: string): { url: string; name: string } {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML invalide.");
  const root = doc.documentElement;
  const groups = new Map<string, Element[]>();
  for (const child of Array.from(root.children)) {
    const list = groups.get(child.tagName) ?? [];
    list.push(child);
    groups.set(child.tagName, list);
  }
  // Le groupe avec le plus d'éléments répétés est considéré comme le tableau de données.
  let rows: Element[] = [];
  for (const list of groups.values()) if (list.length > rows.length) rows = list;
  if (rows.length === 0) throw new Error("Aucune rangée répétée trouvée dans le XML.");
  const records = rows.map((row) => {
    const rec: Record<string, string> = {};
    for (const child of Array.from(row.children)) rec[child.tagName] = child.textContent?.trim() ?? "";
    return rec;
  });
  const columns = [...new Set(records.flatMap((r) => Object.keys(r)))];
  if (columns.length === 0) throw new Error("Aucune colonne détectée dans le XML.");
  const esc = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [columns.join(","), ...records.map((r) => columns.map((c) => esc(r[c])).join(","))];
  return {
    url: URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" })),
    name: "converted.csv",
  };
}

/** Parseur CSV simple avec gestion des guillemets. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === "," || ch === ";") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}
