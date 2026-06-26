export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum TaskStatus {
  PENDING = "pending",
  COMPLETED = "completed",
}

export enum SlotType {
  TASK = "task",
  CALENDAR_EVENT = "calendar_event",
  BREAK = "break",
  BUFFER = "buffer",
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string; // ISO DateTime
  updatedAt: string; // ISO DateTime
  deadline?: string; // ISO DateTime
  priority: TaskPriority;
  aiPriorityReason?: string;
  status: TaskStatus;
  durationMinutes: number;
  riskScore: number; // 0 to 100
  calendarEventId?: string;
  scheduledStartTime?: string; // ISO DateTime
  preferredStartTime?: string; // "now", "1h", "2h", "4h", "tomorrow", etc.
}

export interface TimeSlot {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  type: SlotType;
  taskId?: string;
  title: string;
  notes?: string;
}

export interface Schedule {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  timeSlots: TimeSlot[];
  aiSummary: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}
