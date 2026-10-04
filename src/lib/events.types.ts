export type DomainEventType =
  | "TASK_COMPLETED"
  | "TASK_OVERDUE"
  | "HABIT_COMPLETED"
  | "REMINDER_DUE"
  | "EVENT_UPCOMING"
  | "DOCUMENT_UPLOADED"
  | "PROJECT_COMPLETED";

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  type: T;
  userId: string;
  entityId: string;
  timestamp: string;
  payload: DomainEventPayload;
}

export interface TaskCompletedPayload {
  taskId: string;
  title: string;
  completedAt: string;
}

export interface TaskOverduePayload {
  taskId: string;
  title: string;
  dueDate: string;
}

export interface HabitCompletedPayload {
  habitId: string;
  name: string;
  completedAt: string;
  streak: number;
}

export interface ReminderDuePayload {
  reminderId: string;
  title: string;
  message: string | null;
  triggerAt: string;
}

export interface EventUpcomingPayload {
  eventId: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
}

export interface DocumentUploadedPayload {
  documentId: string;
  filename: string;
  subject: string | null;
  pageCount: number | null;
}

export interface ProjectCompletedPayload {
  projectId: string;
  name: string;
  completedAt: string;
}

export type DomainEventPayload =
  | TaskCompletedPayload
  | TaskOverduePayload
  | HabitCompletedPayload
  | ReminderDuePayload
  | EventUpcomingPayload
  | DocumentUploadedPayload
  | ProjectCompletedPayload
  | Record<string, unknown>;

export function createEvent<T extends DomainEventType>(
  type: T,
  userId: string,
  entityId: string,
  payload: DomainEventPayload
): DomainEvent<T> {
  return {
    type,
    userId,
    entityId,
    timestamp: new Date().toISOString(),
    payload,
  };
}