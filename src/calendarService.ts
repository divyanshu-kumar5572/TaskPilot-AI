import { GoogleCalendarEvent } from "./types";

/**
 * Fetch calendar events for a specific target date
 */
export async function fetchCalendarEvents(
  accessToken: string,
  dateString: string // "YYYY-MM-DD"
): Promise<GoogleCalendarEvent[]> {
  const timeMin = new Date(`${dateString}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${dateString}T23:59:59Z`).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin
  )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
      }
    } catch (_) {
      // ignore
    }
    throw new Error(`Failed to fetch Google Calendar events: ${errorMsg}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Create an event on Google Calendar for a scheduled task
 */
export async function createCalendarEvent(
  accessToken: string,
  taskTitle: string,
  taskDescription: string,
  startTimeIso: string,
  durationMinutes: number
): Promise<string> {
  const start = new Date(startTimeIso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  const body = {
    summary: `TaskPilot AI: ${taskTitle}`,
    description: `${taskDescription}\n\nScheduled and optimized automatically by TaskPilot AI.`,
    start: {
      dateTime: start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminders: {
      useDefault: true,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
      }
    } catch (_) {
      // ignore
    }
    throw new Error(`Failed to create Google Calendar event: ${errorMsg}`);
  }

  const event = await response.json();
  return event.id;
}

/**
 * Delete/Unsync an event from Google Calendar
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Google Calendar event: ${response.statusText}`);
  }
}
