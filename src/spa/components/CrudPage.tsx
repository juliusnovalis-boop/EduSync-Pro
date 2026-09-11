import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui";
import { EmptyState, LoadingRows, PageHeader } from "./ui-kit";
import { useDeleteRow, useRows, useSaveRow, type TableName } from "../lib/data";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "email" | "tel" | "select" | "textarea" | "time" | "list";
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string | number;
  full?: boolean;
  step?: string;
};

export type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export function CrudPage<T extends { id: string }>({
  table,
  title,
  subtitle,
  singular,
  icon,
  fields,
  columns,
  searchable,
  order = "created_at",
  ascending = false,
  toolbar,
  header,
  createBlocked,
}: {
  table: TableName;
  title: string;
  subtitle: string;
  singular: string;
  icon: LucideIcon;
  fields: Field[];
  columns: Column<T>[];
  searchable: (row: T) => string;
  order?: string;
  ascending?: boolean;
  toolbar?: ReactNode;
  header?: (rows: T[]) => ReactNode;
  /** Réforme des comptes : masque la création directe (profil métier = création via Gestion des accès). */
  createBlocked?: string;
}) {
  const { data, isLoading } = useRows<T>(table, { order, ascending });
  const save = useSaveRow(table, singular);
  const remove = useDeleteRow(table, singular);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);

  const rows = data ?? [];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => searchable(row).toLowerCase().includes(term));
  }, [rows, query, searchable]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(row: T) {
    setEditing(row);
    setOpen(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = form.get(field.name);
      const value = raw === null ? "" : String(raw);
      if (field.type === "number") values[field.name] = value === "" ? null : Number(value);
      else if (field.type === "list")
        values[field.name] = value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
      else values[field.name] = value === "" ? null : value;
    }
    save.mutate(
      { id: editing?.id ?? null, values },
      {
        onSuccess: () => {
          setOpen(false);
          setEditing(null);
        },
      },
    );
  }

  const record = editing as Record<string, unknown> | null;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          createBlocked ? (
            <span className="text-xs text-muted-foreground">{createBlocked}</span>
          ) : (
            <Button onClick={openCreate} className="rounded-full">
              <Plus className="mr-1 size-4" /> Nouveau
            </Button>
          )
        }
      />

      {header?.(rows)}

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." className="rounded-full bg-muted pl-9" />
          </div>
          {toolbar}
          <span className="text-sm text-muted-foreground">{filtered.length} résultat(s)</span>
        </div>

        {isLoading ? (
          <div className="p-6">
            <LoadingRows />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={icon} title={`Aucun ${singular.toLowerCase()}`} description="Ajoutez un premier enregistrement pour commencer." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.header} className={column.className}>
                      {column.header}
                    </TableHead>
                  ))}
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((column) => (
                      <TableCell key={column.header} className={column.className}>
                        {column.render(row)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => openEdit(row)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => setPendingDelete(row)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen} className="sm:max-w-2xl">
        <div>
          <DialogCloseButton onClick={() => setOpen(false)} />
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier — ${singular}` : `Nouveau — ${singular}`}</DialogTitle>
            <DialogDescription>Renseignez les informations puis enregistrez.</DialogDescription>
          </DialogHeader>
          <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const current = record?.[field.name];
              const defaultValue = Array.isArray(current)
                ? current.join(", ")
                : current === null || current === undefined
                  ? field.defaultValue ?? ""
                  : String(current);
              return (
                <div key={field.name} className={`space-y-2 ${field.full ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor={field.name}>{field.label}</Label>
                  {field.type === "select" ? (
                    <Select name={field.name} defaultValue={String(defaultValue)}>
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea id={field.name} name={field.name} defaultValue={String(defaultValue)} maxLength={1000} />
                  ) : (
                    <Input
                      id={field.name}
                      name={field.name}
                      type={field.type === "list" ? "text" : (field.type ?? "text")}
                      step={field.step}
                      required={field.required}
                      maxLength={field.type === "number" ? undefined : 255}
                      defaultValue={String(defaultValue)}
                    />
                  )}
                </div>
              );
            })}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </div>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(next: boolean) => !next && setPendingDelete(null)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cet enregistrement ?</AlertDialogTitle>
          <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingDelete) remove.mutate(pendingDelete.id);
              setPendingDelete(null);
            }}
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  );
}
