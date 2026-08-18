import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "./api";

export type TableName =
  | "students"
  | "teachers"
  | "classes"
  | "subjects"
  | "grades"
  | "attendance"
  | "payments"
  | "course_sessions"
  | "profiles"
  | "user_roles"
  | "provinces"
  | "establishments"
  | "announcements"
  | "messages"
  | "assignments"
  | "events"
  | "qr_codes"
  | "digital_documents"
  | "attendance_sessions"
  | "attendance_qr_records"
  | "qr_scan_history"
  | "parent_student_links"
  | "notifications"
  | "ai_conversations"
  | "ai_conversation_messages"
  | "ai_support_plans"
  | "ai_documents"
  | "automation_rules"
  | "automation_logs"
  | "analytics_snapshots"
  | "ambassadors"
  | "partners"
  | "pilot_programs"
  | "ai_access_logs";

type Options = { order?: string; ascending?: boolean; limit?: number };

function sortRows<T>(rows: T[], order: string, ascending: boolean): T[] {
  return [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[order];
    const bv = (b as unknown as Record<string, unknown>)[order];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return ascending ? cmp : -cmp;
  });
}

export function useRows<T>(table: TableName, options: Options = {}) {
  const { order = "created_at", ascending = false, limit = 2000 } = options;
  return useQuery<T[]>({
    queryKey: [table, order, ascending, limit],
    queryFn: async () => {
      const sp = new URLSearchParams({
        order,
        ascending: String(ascending),
        limit: String(limit),
      });
      const res = await apiFetch(`/api/data/${table}?${sp.toString()}`);
      if (!res.ok) throw new Error("Échec du chargement");
      const data = (await res.json()) as T[];
      return sortRows(data, order, ascending);
    },
  });
}

export function useSaveRow(table: TableName, label = "Enregistrement") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | null; values: Record<string, unknown> }) => {
      if (id) {
        const res = await apiFetch(`/api/data/${table}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) throw new Error((await safeErr(res)) ?? "Erreur");
      } else {
        const res = await apiFetch(`/api/data/${table}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) throw new Error((await safeErr(res)) ?? "Erreur");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} enregistré`);
    },
    onError: (error: Error) => toast.error("Erreur", { description: error.message }),
  });
}

export function useDeleteRow(table: TableName, label = "Élément") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/data/${table}/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await safeErr(res)) ?? "Erreur");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} supprimé`);
    },
    onError: (error: Error) => toast.error("Erreur", { description: error.message }),
  });
}

export function useBulkInsert(table: TableName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) => {
      const res = await apiFetch(`/api/data/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error((await safeErr(res)) ?? "Erreur");
      return res.json();
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [table] }),
    onError: (error: Error) => toast.error("Erreur", { description: error.message }),
  });
}

export function useUpsertRows(table: TableName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) => {
      const res = await apiFetch(`/api/data/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsert: true, rows }),
      });
      if (!res.ok) throw new Error((await safeErr(res)) ?? "Erreur");
      return res.json();
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [table] }),
    onError: (error: Error) => toast.error("Erreur", { description: error.message }),
  });
}

async function safeErr(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error;
  } catch {
    return undefined;
  }
}