/**
 * EDUSYNC NOTIFICATIONS — Module 10 (Centre de notifications unifié)
 *
 * Couche serveur pour créer, lister, marquer comme lues et filtrer les
 * notifications. Chaque notification est rattachée à un utilisateur précis
 * (destinataire) et à une catégorie (SCOLARITE, ABSENCE, NOTE, DEVOIR,
 * MESSAGE, ADMINISTRATION, SYSTEME, ALERT).
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

export type NotificationCategory =
  | "SCOLARITE"
  | "ABSENCE"
  | "NOTE"
  | "DEVOIR"
  | "MESSAGE"
  | "ADMINISTRATION"
  | "SYSTEME"
  | "ALERT";

export type NotificationPriority = "low" | "normal" | "high";

export interface CreateNotificationInput {
  userId: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  relatedId?: string;
  relatedType?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(notifications).values({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: input.userId,
    category: input.category,
    title: input.title,
    body: input.body ?? null,
    priority: input.priority ?? "normal",
    read: false,
    action_url: input.actionUrl ?? null,
    related_id: input.relatedId ?? null,
    related_type: input.relatedType ?? null,
    created_at: now,
  });
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  const now = new Date().toISOString();
  if (!inputs.length) return;
  await db.insert(notifications).values(
    inputs.map((i) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(0, 4)}`,
      user_id: i.userId,
      category: i.category,
      title: i.title,
      body: i.body ?? null,
      priority: i.priority ?? "normal",
      read: false,
      action_url: i.actionUrl ?? null,
      related_id: i.relatedId ?? null,
      related_type: i.relatedType ?? null,
      created_at: now,
    })),
  );
}

export interface ListNotificationsOptions {
  userId: string;
  category?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function listNotifications(options: ListNotificationsOptions): Promise<{
  items: Array<Record<string, unknown>>;
  total: number;
  unread: number;
}> {
  const { userId, category, unreadOnly, limit = 50, offset = 0 } = options;

  const conditions = [eq(notifications.user_id, userId)];
  if (category) conditions.push(eq(notifications.category, category));
  if (unreadOnly) conditions.push(eq(notifications.read, false));

  const where = and(...conditions);

  const [rows, totalRows, unreadRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.created_at))
      .limit(Math.min(limit, 200))
      .offset(offset),
    db.select({ c: sql`count(*)::int` }).from(notifications).where(where),
    db
      .select({ c: sql`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.user_id, userId), eq(notifications.read, false))),
  ]);

  return {
    items: rows as unknown as Array<Record<string, unknown>>,
    total: (totalRows as unknown as { c: number }[])[0]?.c ?? 0,
    unread: (unreadRows as unknown as { c: number }[])[0]?.c ?? 0,
  };
}

export async function setNotificationRead(userId: string, notificationId: string, read: boolean): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ read })
    .where(and(eq(notifications.id, notificationId), eq(notifications.user_id, userId)))
    .returning({ id: sql`1` });
  return rows.length > 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.user_id, userId), eq(notifications.read, false)));
}

export async function deleteNotification(userId: string, notificationId: string): Promise<boolean> {
  const rows = await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.user_id, userId)))
    .returning({ id: sql`1` });
  return rows.length > 0;
}

export async function countUnread(userId: string): Promise<number> {
  const rows = await db
    .select({ c: sql`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.user_id, userId), eq(notifications.read, false)));
  return (rows as unknown as { c: number }[])[0]?.c ?? 0;
}
