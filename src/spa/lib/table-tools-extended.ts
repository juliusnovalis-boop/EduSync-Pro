// Conversions de données étendues côté navigateur — aucun envoi serveur requis.

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Formater et indenter un JSON. */
export function formatJson(jsonText: string): { url: string; name: string } {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("JSON invalide — impossible de formater.");
  }
  const formatted = JSON.stringify(data, null, 2);
  return {
    url: URL.createObjectURL(new Blob([formatted], { type: "application/json" })),
    name: "formatted.json",
  };
}

/** Valider la syntaxe d''un JSON. */
export function validateJson(jsonText: string): { valid: boolean; error: string | null; preview: string } {
  try {
    const data = JSON.parse(jsonText);
    const preview = JSON.stringify(data, null, 2).slice(0, 500);
    return { valid: true, error: null, preview };
  } catch (e) {
    return { valid: false, error: (e as Error).message, preview: "" };
  }
}

/** Convertir un CSV en tableau JSON. */
export function csvToJson(csv: string): { url: string; name: string } {
  const rows = parseCsv(csv);
  if (rows.length === 0) throw new Error("CSV vide.");
  const headers = rows[0];
  const records = rows.slice(1).map((row) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => { rec[h] = row[i] ?? ""; });
    return rec;
  });
  return {
    url: URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" })),
    name: "converted.json",
  };
}

/** Diviser un CSV en plusieurs fichiers selon une taille de lot (passée en texte). */
export function splitCsv(csv: string, batchSizeInput?: string): { url: string; name: string; parts: { url: string; name: string }[] } {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("CSV invalide ou vide.");
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const batchSize = Math.max(1, Math.min(parseInt(batchSizeInput ?? "100", 10) || 100, 5000));
  const parts: { url: string; name: string }[] = [];
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const chunk = dataRows.slice(i, i + batchSize);
    const csvContent = [headers, ...chunk].map((r) => r.map(csvEscape).join(",")).join("\n");
    parts.push({
      url: URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" })),
      name: `part-${Math.floor(i / batchSize) + 1}.csv`,
    });
  }
  return { url: parts[0]?.url ?? "", name: "split", parts };
}

/** Nettoyer un CSV : supprimer les espaces superflus, normaliser. */
export function cleanCsv(csv: string): { url: string; name: string } {
  const rows = parseCsv(csv);
  const cleaned = rows.map((row) => row.map((c) => c.trim()));
  const csvContent = cleaned.map((r) => r.map(csvEscape).join(",")).join("\n");
  return {
    url: URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" })),
    name: "cleaned.csv",
  };
}

/** Parseur CSV simple avec gestion des guillemets (réutilisé de table-tools.ts). */
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

function csvEscape(s: string): string {
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}