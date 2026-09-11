import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  GraduationCap,
  Building2,
  BookOpen,
  ClipboardList,
  ScanLine,
  CalendarCheck,
  Wallet,
  Trophy,
  FileText,
  CalendarDays,
  BarChart3,
  Sparkles,
  Settings,
  Megaphone,
  NotebookPen,
  CalendarRange,
  QrCode,
  Camera,
  FileStack,
  IdCard,
  Printer,
  FolderOpen,
  ShieldCheck,
  Bell,
  BotMessageSquare,
  type LucideIcon,
  Wrench,
  Library,
} from "lucide-react";
import { PERM } from "../lib/types";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth";

type NavItem = { title: string; url: string; icon: LucideIcon; permission?: string };

export const NAV_ITEMS: NavItem[] = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutGrid, permission: PERM.DASHBOARD_VIEW },
  { title: "Élèves", url: "/students", icon: Users, permission: PERM.USERS_READ },
  { title: "Enseignants", url: "/teachers", icon: GraduationCap, permission: PERM.SCHOOLS_READ },
  { title: "Classes", url: "/classes", icon: Building2, permission: PERM.CLASSES_READ },
  { title: "Matières", url: "/subjects", icon: BookOpen, permission: PERM.SUBJECTS_READ },
  { title: "Notes", url: "/grades", icon: ClipboardList, permission: PERM.GRADES_READ },
  { title: "Scan de copies", url: "/ocr-grades", icon: ScanLine, permission: PERM.GRADES_UPDATE },
  { title: "Présences", url: "/attendance", icon: CalendarCheck, permission: PERM.ATTENDANCE_READ },
  { title: "Paiements", url: "/payments", icon: Wallet, permission: PERM.PAYMENTS_READ },
  { title: "Classement", url: "/ranking", icon: Trophy, permission: PERM.GRADES_READ },
  { title: "Bulletins", url: "/bulletins", icon: FileText, permission: PERM.GRADES_READ },
  { title: "Emploi du temps", url: "/timetable", icon: CalendarDays, permission: PERM.DASHBOARD_VIEW },
  { title: "Rapports", url: "/reports", icon: BarChart3, permission: PERM.CLASSES_READ },
  { title: "Analyse IA", url: "/ia-analysis", icon: Sparkles, permission: PERM.AI_USE },
  { title: "Assistant EduSync", url: "/ai-assistant", icon: BotMessageSquare, permission: PERM.AI_ASSISTANT_USE },
  { title: "Notifications", url: "/notifications", icon: Bell, permission: PERM.NOTIFICATIONS_READ },
  { title: "QR Center", url: "/qr-center", icon: QrCode, permission: PERM.USERS_READ },
  { title: "Scanner", url: "/scanner", icon: Camera, permission: PERM.CLASSES_READ },
  { title: "Présence QR", url: "/qr-attendance", icon: ScanLine, permission: PERM.ATTENDANCE_MANAGE },
  { title: "Document Studio", url: "/document-studio", icon: FileStack, permission: PERM.DOCUMENTS_MANAGE },
  { title: "Cartes scolaires", url: "/student-cards", icon: IdCard, permission: PERM.USERS_READ },
  { title: "Impression", url: "/print-center", icon: Printer, permission: PERM.DOCUMENTS_MANAGE },
  { title: "Documents", url: "/documents", icon: FolderOpen, permission: PERM.DOCUMENTS_READ },
  { title: "Communication", url: "/communication", icon: Megaphone, permission: PERM.COMMUNICATION_USE },
  { title: "Devoirs", url: "/assignments", icon: NotebookPen, permission: PERM.DOCUMENTS_READ },
  { title: "Calendrier", url: "/calendar", icon: CalendarRange, permission: PERM.DASHBOARD_VIEW },
  { title: "Établissements", url: "/establishments", icon: Building2, permission: PERM.SCHOOLS_READ },
  { title: "Gestion des accès", url: "/access", icon: ShieldCheck, permission: PERM.USERS_CREATE },
  { title: "EduSync Tools", url: "/tools", icon: Wrench, permission: PERM.TOOLS_USE },
  { title: "EduSync Knowledge", url: "/knowledge", icon: Library, permission: PERM.KNOWLEDGE_READ },
  { title: "Paramètres", url: "/settings", icon: Settings, permission: PERM.DASHBOARD_VIEW },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-4">
        <NavLink to="/dashboard" onClick={onNavigate} className="flex items-center gap-3">
          <span className="gradient-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[var(--shadow-float)]">
            <GraduationCap className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-extrabold tracking-tight">EduSync Pro</span>
            <span className="block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">SCHOOL MANAGER</span>
          </span>
        </NavLink>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <item.icon className="size-5 shrink-0" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}