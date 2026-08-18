/**
 * EDUSYNC AUTOMATION ENGINE — Module 11
 *
 * Moteur d'automatisation flexible pour déclencher des actions selon des
 * événements métier :
 *
 *   SI une absence est enregistrée        → notification parent
 *   SI une nouvelle note est publiée      → notification élève/parent
 *   SI un devoir est publié               → notification classe
 *   SI un rapport est généré              → disponibilité dans les documents
 *
 * L'architecture est extensible : de nouveaux triggers/actions peuvent être
 * ajoutés sans modifier le noyau. Chaque exécution est journalisée
 * (automation_logs) pour l'observabilité (Module 25).
 */

import { db } from "@/db";
import { automationRules, automationLogs, parentStudentLinks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createNotifications } from "./notifications";

/* -------------------------- Types & registres -------------------------- */

export const AUTOMATION_TRIGGERS = {
  ATTENDANCE_RECORDED: "attendance_recorded",
  GRADE_CREATED: "grade_created",
  ASSIGNMENT_PUBLISHED: "assignment_published",
  DOCUMENT_GENERATED: "document_generated",
} as const;

export const AUTOMATION_ACTIONS = {
  NOTIFY_PARENT: "notify_parent",
  NOTIFY_STUDENT: "notify_student",
  NOTIFY_TEACHER: "notify_teacher",
  NOTIFY_ADMIN: "notify_admin",
} as const;

export interface AutomationEvent {
  trigger: string;
  userId?: string;
  studentId?: string;
  classId?: string;
  payload: Record<string, unknown>;
}

interface RuleRow {
  id: string;
  name: string | null;
  description: string | null;
  trigger: string | null;
  condition: string | null;
  action: string | null;
  target_role: string | null;
  enabled: boolean | null;
  created_by: string | null;
}

/* ------------------------------ Exécution ------------------------------ */

export async function runAutomation(event: AutomationEvent): Promise<void> {
  try {
    const rules = await db
      .select()
      .from(automationRules)
      .where(eq(automationRules.trigger, event.trigger));

    const active = rules.filter((r) => r.enabled !== false) as unknown as RuleRow[];

    for (const rule of active) {
      try {
        await executeRule(rule, event);
        await logExecution(rule.id, event.trigger, "success", { action: rule.action });
      } catch (err) {
        await logExecution(rule.id, event.trigger, "error", { error: String((err as Error).message) });
      }
    }
  } catch (err) {
    console.error("[automation] erreur moteur :", (err as Error).message);
  }
}

async function executeRule(rule: RuleRow, event: AutomationEvent): Promise<void> {
  const action = rule.action ?? "";

  if (action === AUTOMATION_ACTIONS.NOTIFY_PARENT && event.studentId) {
    await notifyParentsOfStudent(event.studentId, event.trigger, event.payload);
    return;
  }

  if (action === AUTOMATION_ACTIONS.NOTIFY_STUDENT && event.userId) {
    await createNotifications([{
      userId: event.userId,
      category: categoryForTrigger(event.trigger),
      title: titleForEvent(event.trigger, event.payload),
      body: bodyForEvent(event.trigger, event.payload),
      priority: "normal",
      relatedId: event.studentId ?? undefined,
      relatedType: relatedTypeForTrigger(event.trigger),
    }]);
    return;
  }
}

async function notifyParentsOfStudent(
  studentId: string,
  trigger: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const links = await db
    .select({ parentUserId: parentStudentLinks.parent_user_id })
    .from(parentStudentLinks)
    .where(eq(parentStudentLinks.student_id, studentId))
    .limit(20);

  if (!links.length) return;

  await createNotifications(
    links.map((l) => ({
      userId: l.parentUserId,
      category: categoryForTrigger(trigger),
      title: titleForEvent(trigger, payload),
      body: bodyForEvent(trigger, payload),
      priority: trigger === AUTOMATION_TRIGGERS.ATTENDANCE_RECORDED ? "high" : "normal",
      relatedId: studentId,
      relatedType: relatedTypeForTrigger(trigger),
    })),
  );
}

/* --------------------- Helpers -------------------- */

function categoryForTrigger(trigger: string): "SCOLARITE" | "ABSENCE" | "NOTE" | "DEVOIR" | "SYSTEME" {
  switch (trigger) {
    case AUTOMATION_TRIGGERS.ATTENDANCE_RECORDED: return "ABSENCE";
    case AUTOMATION_TRIGGERS.GRADE_CREATED: return "NOTE";
    case AUTOMATION_TRIGGERS.ASSIGNMENT_PUBLISHED: return "DEVOIR";
    case AUTOMATION_TRIGGERS.DOCUMENT_GENERATED: return "SCOLARITE";
    default: return "SYSTEME";
  }
}

function relatedTypeForTrigger(trigger: string): string {
  switch (trigger) {
    case AUTOMATION_TRIGGERS.ATTENDANCE_RECORDED: return "attendance";
    case AUTOMATION_TRIGGERS.GRADE_CREATED: return "grade";
    case AUTOMATION_TRIGGERS.ASSIGNMENT_PUBLISHED: return "assignment";
    case AUTOMATION_TRIGGERS.DOCUMENT_GENERATED: return "document";
    default: return "notification";
  }
}

function titleForEvent(trigger: string, payload: Record<string, unknown>): string {
  const subject = typeof payload.subject === "string" ? payload.subject : undefined;
  switch (trigger) {
    case AUTOMATION_TRIGGERS.ATTENDANCE_RECORDED:
      return subject ? `Absence enregistrée — ${subject}` : "Absence enregistrée";
    case AUTOMATION_TRIGGERS.GRADE_CREATED:
      return subject ? `Nouvelle note publiée — ${subject}` : "Nouvelle note publiée";
    case AUTOMATION_TRIGGERS.ASSIGNMENT_PUBLISHED:
      return "Nouveau devoir publié";
    case AUTOMATION_TRIGGERS.DOCUMENT_GENERATED:
      return "Document généré";
    default:
      return "Notification EduSync";
  }
}

function bodyForEvent(trigger: string, payload: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof payload.student === "string") parts.push(`Élève : ${payload.student}`);
  if (typeof payload.value === "number") parts.push(`Note : ${payload.value}/20`);
  if (typeof payload.list === "string") parts.push(payload.list);
  return parts.length ? parts.join(" · ") : "";
}

/* --------------------------- Journal des logs -------------------------- */

async function logExecution(
  ruleId: string,
  eventType: string,
  result: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(automationLogs).values({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      rule_id: ruleId,
      event_type: eventType,
      result,
      details: JSON.stringify(details),
      created_at: new Date().toISOString(),
    });
  } catch {
    /* non bloquant */
  }
}

export async function listAutomationLogs(limit = 100, offset = 0) {
  const rows = await db
    .select()
    .from(automationLogs)
    .orderBy(desc(automationLogs.created_at))
    .limit(Math.min(limit, 500))
    .offset(offset);
  return rows as unknown as Array<Record<string, unknown>>;
}