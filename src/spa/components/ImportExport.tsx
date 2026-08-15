import { useRef, useState } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui";
import { toCsv, downloadCsv } from "../lib/grades";
import type { TableName } from "../lib/data";

/**
 * Composant réutilisable d'import/export CSV pour n'importe quelle table.
 * - Export : télécharge toutes les lignes au format CSV
 * - Import : parse un fichier CSV → insertion en masse via l'API
 */
export function ImportExport({
  table,
  columns,
  filename,
  label = "données",
}: {
  table: TableName;
  columns: { key: string; label: string }[];
  filename: string;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  async function handleExport() {
    try {
      const res = await fetch(`/api/data/${table}?limit=5000`);
      if (!res.ok) throw new Error("Échec de l'export");
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows.length) return toast.error("Aucune donnée à exporter");
      const headers = columns.map((c) => c.label);
      const data = rows.map((r) => columns.map((c) => String(r[c.key] ?? "")));
      downloadCsv(filename, toCsv(headers, data));
      toast.success(`${rows.length} ${label} exporté(s)`);
    } catch (e) {
      toast.error("Export échoué", { description: (e as Error).message });
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const records = parseCsv(text, columns.map((c) => c.key));
      if (!records.length) return toast.error("Aucune donnée valide dans le fichier");

      const res = await fetch(`/api/data/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Échec de l'import");
      }
      const result = await res.json();
      toast.success(`${result.inserted ?? records.length} ${label} importé(s)`);
      void queryClient.invalidateQueries({ queryKey: [table] });
    } catch (e) {
      toast.error("Import échoué", { description: (e as Error).message });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="mr-1.5 size-3.5" /> Exporter CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />} Importer CSV
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
        }}
      />
    </div>
  );
}

/** Parseur CSV simple (séparateur ; ou ,) → objets avec les clés spécifiées. */
function parseCsv(text: string, keys: string[]): Record<string, unknown>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === sep && !inQuotes) { result.push(current); current = ""; continue; }
      current += ch;
    }
    result.push(current);
    return result.map((s) => s.trim());
  };

  const records: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const record: Record<string, unknown> = {};
    for (let j = 0; j < keys.length && j < values.length; j++) {
      const val = values[j]?.trim() ?? "";
      if (val !== "" && !isNaN(Number(val)) && keys[j].match(/(value|amount|coefficient|max_value|capacity|max_score|day_of_week)/)) {
        record[keys[j]] = Number(val);
      } else {
        record[keys[j]] = val === "" ? null : val;
      }
    }
    records.push(record);
  }
  return records;
}
