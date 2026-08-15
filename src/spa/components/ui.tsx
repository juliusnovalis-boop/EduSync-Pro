import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  link: "text-primary underline-offset-4 hover:underline",
};
const SIZES: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "size-9",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ Inputs */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Select */

type SelectContext = {
  value: string;
  setValue: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  labels: Record<string, string>;
  register: (value: string, label: string) => void;
  placeholder?: string;
};

const Ctx = createContext<SelectContext | null>(null);
function useCtx() {
  const c = useContext(Ctx);
  if (!c) throw new Error("Select components must be used inside <Select>");
  return c;
}

export function Select({
  value: controlled,
  defaultValue = "",
  onValueChange,
  name,
  placeholder,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  name?: string;
  placeholder?: string;
  children: ReactNode;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const value = controlled ?? internal;
  const setValue = (v: string) => {
    if (controlled === undefined) setInternal(v);
    onValueChange?.(v);
    setOpen(false);
  };
  const register = (val: string, label: string) => {
    setLabels((prev) => (prev[val] === label ? prev : { ...prev, [val]: label }));
  };
  return (
    <Ctx.Provider value={{ value, setValue, open, setOpen, labels, register, placeholder }}>
      <div className="relative">{children}</div>
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
    </Ctx.Provider>
  );
}

export function SelectTrigger({ className, children, id }: { className?: string; children?: ReactNode; id?: string }) {
  const ctx = useCtx();
  return (
    <button
      id={id}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        ctx.setOpen(!ctx.open);
      }}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children ?? <SelectValue />}
      <svg className="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = useCtx();
  const label = ctx.value ? ctx.labels[ctx.value] ?? ctx.value : "";
  return <span className={cn("truncate", !ctx.value && "text-muted-foreground")}>{label || placeholder || ctx.placeholder || "Sélectionner"}</span>;
}

export function SelectContent({ children }: { children: ReactNode }) {
  const ctx = useCtx();
  useEffect(() => {
    if (!ctx.open) return;
    const close = () => ctx.setOpen(false);
    window.addEventListener("click", close);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && ctx.setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [ctx.open, ctx.setOpen]);
  if (!ctx.open) return null;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="animate-zoom-in absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useCtx();
  const label = String(children);
  useEffect(() => {
    ctx.register(value, label);
  }, [ctx, value, label]);
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        ctx.value === value && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Table */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={cn("w-full caption-bottom text-sm", className)}>
      {children}
    </table>
  );
}
export function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border">{children}</thead>;
}
export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}
export function TableRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-b border-border/60 transition-colors hover:bg-muted/40", className)}>{children}</tr>;
}
export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn("h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </th>
  );
}
export function TableCell({ children, className, colSpan }: { children: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

/* ------------------------------------------------------------------ Dialog */

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 animate-in" onClick={() => onOpenChange(false)} />
      <div className={cn("animate-zoom-in relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg", className)}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-4 space-y-1.5">{children}</div>;
}
export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-bold tracking-tight">{children}</h2>;
}
export function DialogDescription({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-2 flex justify-end gap-2", className)}>{children}</div>;
}

/* ------------------------------------------------------------ AlertDialog */

export function AlertDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </Dialog>
  );
}
export function AlertDialogHeader({ children }: { children: ReactNode }) {
  return <DialogHeader>{children}</DialogHeader>;
}
export function AlertDialogTitle({ children }: { children: ReactNode }) {
  return <DialogTitle>{children}</DialogTitle>;
}
export function AlertDialogDescription({ children }: { children: ReactNode }) {
  return <DialogDescription>{children}</DialogDescription>;
}
export function AlertDialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}
export function AlertDialogCancel({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      {children}
    </Button>
  );
}
export function AlertDialogAction({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <Button variant="destructive" onClick={onClick}>
      {children}
    </Button>
  );
}

/* ------------------------------------------------------------------ Close X */

export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground opacity-70 transition hover:bg-accent hover:opacity-100"
    >
      <X className="size-4" />
    </button>
  );
}

/* ------------------------------------------------------------------ Tabs */

const TabsContext = createContext<{ value: string; setValue: (v: string) => void } | null>(null);

export function Tabs({
  defaultValue,
  children,
  className,
  onValueChange,
}: {
  defaultValue: string;
  children: ReactNode;
  className?: string;
  onValueChange?: (v: string) => void;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const setValue = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ value: internal, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}
export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("inline-flex h-10 items-center gap-1 rounded-lg bg-muted p-1", className)}>{children}</div>;
}
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)!;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-all",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.value !== value) return null;
  return <div className={cn("mt-2", className)}>{children}</div>;
}
