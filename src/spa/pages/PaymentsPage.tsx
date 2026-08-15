import { Wallet } from "lucide-react";
import { CrudPage } from "../components/CrudPage";
import { ImportExport } from "../components/ImportExport";
import { Pill, StatCard } from "../components/ui-kit";
import { useRows } from "../lib/data";
import { PAYMENT_METHODS, PAYMENT_TYPES, formatMoney, fullName, type Payment, type Student } from "../lib/types";

export default function PaymentsPage() {
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const studentById = new Map((students.data ?? []).map((s) => [s.id, fullName(s)]));
  return (
    <CrudPage<Payment>
      table="payments"
      title="Paiements"
      subtitle="Recettes, échéances et statuts de règlement"
      singular="Paiement"
      icon={Wallet}
      order="date"
      toolbar={<ImportExport table="payments" filename="paiements-edusync.csv" label="paiement(s)" columns={[
        { key: "student_id", label: "Élève ID" }, { key: "amount", label: "Montant" }, { key: "type", label: "Type" },
        { key: "method", label: "Moyen" }, { key: "date", label: "Date" }, { key: "status", label: "Statut" }, { key: "reference", label: "Référence" },
      ]} />}
      searchable={(r) => `${studentById.get(r.student_id) ?? ""} ${r.reference ?? ""} ${r.type}`}
      header={(rows) => {
        const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
        const paid = rows.filter((r) => r.status === "paye").reduce((s, r) => s + Number(r.amount || 0), 0);
        return (
          <div className="mb-6 grid gap-5 sm:grid-cols-3">
            <StatCard label="Total encaissé" value={formatMoney(paid)} icon={Wallet} tone="green" />
            <StatCard label="Montant total" value={formatMoney(total)} icon={Wallet} tone="violet" />
            <StatCard label="En attente" value={formatMoney(total - paid)} icon={Wallet} tone="amber" />
          </div>
        );
      }}
      fields={[
        { name: "student_id", label: "Élève", type: "select", required: true, options: (students.data ?? []).map((s) => ({ value: s.id, label: fullName(s) })) },
        { name: "amount", label: "Montant (FCFA)", type: "number", required: true },
        { name: "type", label: "Type", type: "select", defaultValue: "scolarite", options: Object.entries(PAYMENT_TYPES).map(([v, l]) => ({ value: v, label: l })) },
        { name: "method", label: "Moyen de paiement", type: "select", defaultValue: "especes", options: Object.entries(PAYMENT_METHODS).map(([v, l]) => ({ value: v, label: l })) },
        { name: "date", label: "Date", type: "date", defaultValue: new Date().toISOString().slice(0, 10) },
        { name: "month", label: "Mois concerné" },
        { name: "status", label: "Statut", type: "select", defaultValue: "paye", options: [{ value: "paye", label: "Payé" }, { value: "partiel", label: "Partiel" }, { value: "en_attente", label: "En attente" }] },
        { name: "reference", label: "Référence" },
        { name: "note", label: "Note", type: "textarea", full: true },
      ]}
      columns={[
        { header: "Élève", render: (r) => <span className="font-semibold">{studentById.get(r.student_id) ?? "—"}</span> },
        { header: "Montant", render: (r) => <span className="font-bold">{formatMoney(Number(r.amount))}</span> },
        { header: "Type", render: (r) => PAYMENT_TYPES[r.type] ?? r.type },
        { header: "Moyen", render: (r) => PAYMENT_METHODS[r.method] ?? r.method },
        { header: "Date", render: (r) => r.date },
        { header: "Statut", render: (r) => <Pill tone={r.status === "paye" ? "success" : r.status === "partiel" ? "warning" : "danger"}>{r.status === "paye" ? "Payé" : r.status === "partiel" ? "Partiel" : "En attente"}</Pill> },
      ]}
    />
  );
}
