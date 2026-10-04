import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createEvent,
  type DomainEvent,
  type TaskCompletedPayload,
  type TaskOverduePayload,
  type HabitCompletedPayload,
  type ReminderDuePayload,
  type EventUpcomingPayload,
  type DocumentUploadedPayload,
  type ProjectCompletedPayload,
} from "./events.types";

export async function emitTaskCompleted(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  title: string,
): Promise<void> {
  const event = createEvent("TASK_COMPLETED", userId, taskId, {
    taskId,
    title,
    completedAt: new Date().toISOString(),
  } satisfies Parameters<typeof createEvent>[3]);
  await emitEvent(supabase, userId, event);
}

export async function emitTaskOverdue(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  title: string,
  dueDate: string,
): Promise<void> {
  const event = createEvent("TASK_OVERDUE", userId, taskId, {
    taskId,
    title,
    dueDate,
  } satisfies Parameters<typeof createEvent>[3]);
  await emitEvent(supabase, userId, event);
}

export async function emitHabitCompleted(
  supabase: SupabaseClient,
  userId: string,
  habitId: string,
  name: string,
  streak: number,
): Promise<void> {
  const event = createEvent("HABIT_COMPLETED", userId, habitId, {
    habitId,
    name,
    completedAt: new Date().toISOString(),
    streak,
  } satisfies Parameters<typeof createEvent>[3]);
  await emitEvent(supabase, userId, event);
}

export async function emitReminderDue(
  supabase: SupabaseClient,
  userId: string,
  reminderId: string,
  title: string,
  message: string | null,
  triggerAt: string,
): Promise<void> {
  const event = createEvent("REMINDER_DUE", userId, reminderId, {
    reminderId,
    title,
    message,
    triggerAt,
  } satisfies Parameters<typeof createEvent>[3]);
  await emitEvent(supabase, userId, event);
}

export async function emitEventUpcoming(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  title: string,
  startAt: string,
  endAt: string,
  location: string | null,
): Promise<void> {
  const event = createEvent("EVENT_UPCOMING", userId, eventId, {
    eventId,
    title,
    startAt,
    endAt,
    location,
  } satisfies Parameters<typeof createEvent>[3]);
  await emitEvent(supabase, userId, event);
}

export async function emitDocumentUploaded(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
  filename: string,
  subject: string | null,
  pageCount: number | null,
): Promise<void> {
  const event = createEvent("DOCUMENT_UPLOADED", userId, documentId, {
    documentId,
    filename,
    subject,
    pageCount,
  } satisfies Parameters<typeof createEvent>[3]);
  await emitEvent(supabase, userId, event);
}

export async function emitProjectCompleted(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  name: string,
): Promise<void> {
  const event = createEvent("PROJECT_COMPLETED", userId, projectId, {
    projectId,
    name,
    completedAt: new Date().toISOString(),
  } satisfies Parameters<typeof createEvent>[3]);
  await emitEvent(supabase, userId, event);
}

async function emitEvent(supabase: SupabaseClient, userId: string, event: any): Promise<void> {
  const { data: existing } = await supabase
    .from("event_emission_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", event.type)
    .eq("entity_id", event.entityId)
    .eq("event_timestamp", event.timestamp)
    .maybeSingle();

  if (existing) {
    return;
  }

  await supabase.from("event_emission_logs").insert({
    user_id: userId,
    event_type: event.type,
    entity_id: event.entityId,
    event_timestamp: event.timestamp,
    payload: event.payload,
  });

  await dispatchEventInternal(supabase, userId, event);
}

async function dispatchEventInternal(
  supabase: SupabaseClient,
  userId: string,
  event: any,
): Promise<void> {
  const { dispatchEvent } = await import("./event.dispatcher");
  await dispatchEvent(supabase, userId, event);
}
