import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES: Record<string, string> = {
  violet: "bg-primary text-primary-foreground",
  blue: "bg-info text-info-foreground",
  green: "bg-success text-success-foreground",
  amber: "bg-warning text-warning-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "violet",
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: keyof typeof TONES | string;
  hint?: string;
}) {
  return (
    <div className="surface-card flex items-start justify-between gap-4 p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", TONES[tone] ?? TONES.violet)}>
        <Icon className="size-5" />
      </span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-7" />
      </span>
      <p className="mt-5 text-lg font-bold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card p-6", className)}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {Icon && <Icon className="size-5 text-primary" />}
      </header>
      {children}
    </section>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warning" | "danger" | "primary" | "info";
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/12 text-success",
    warning: "bg-warning/25 text-warning-foreground",
    danger: "bg-destructive/12 text-destructive",
    primary: "bg-accent text-accent-foreground",
    info: "bg-info/12 text-info",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize", tones[tone])}>
      {children}
    </span>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
