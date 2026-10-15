import { GoogleCalendarEvent, PlannedTask } from '../types';

const BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export async function listGoogleCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '50');

  if (timeMin) {
    url.searchParams.set('timeMin', timeMin);
  } else {
    // Default to start of current month
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    url.searchParams.set('timeMin', d.toISOString());
  }

  if (timeMax) {
    url.searchParams.set('timeMax', timeMax);
  } else {
    // Default to 60 days in the future
    const d = new Date();
    d.setDate(d.getDate() + 60);
    url.searchParams.set('timeMax', d.toISOString());
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to fetch Google Calendar events (${res.status})`
    );
  }

  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || '(Untitled Event)',
    description: item.description,
    start: item.start || {},
    end: item.end || {},
    htmlLink: item.htmlLink,
    status: item.status,
  }));
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM
    durationMinutes?: number;
  }
): Promise<GoogleCalendarEvent> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let body: any = {
    summary: event.summary,
    description: event.description || 'Created via Vega Core Study Planner',
  };

  if (event.time) {
    const [h, m] = event.time.split(':').map(Number);
    const startDate = new Date(event.date + 'T' + event.time + ':00');
    const endDate = new Date(startDate.getTime() + (event.durationMinutes || 45) * 60000);

    body.start = {
      dateTime: startDate.toISOString(),
      timeZone,
    };
    body.end = {
      dateTime: endDate.toISOString(),
      timeZone,
    };
  } else {
    // All-day event
    const nextDay = new Date(event.date + 'T00:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayIso = nextDay.toISOString().slice(0, 10);

    body.start = { date: event.date };
    body.end = { date: nextDayIso };
  }

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to create Google Calendar event (${res.status})`
    );
  }

  return await res.json();
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  event: {
    summary: string;
    description?: string;
    date: string;
    time?: string;
    durationMinutes?: number;
  }
): Promise<GoogleCalendarEvent> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let body: any = {
    summary: event.summary,
    description: event.description,
  };

  if (event.time) {
    const startDate = new Date(event.date + 'T' + event.time + ':00');
    const endDate = new Date(startDate.getTime() + (event.durationMinutes || 45) * 60000);

    body.start = {
      dateTime: startDate.toISOString(),
      timeZone,
    };
    body.end = {
      dateTime: endDate.toISOString(),
      timeZone,
    };
  } else {
    const nextDay = new Date(event.date + 'T00:00:00');
    nextDay.setDate(nextDay.getDate() + 1);

    body.start = { date: event.date };
    body.end = { date: nextDay.toISOString().slice(0, 10) };
  }

  const res = await fetch(`${BASE_URL}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to update Google Calendar event (${res.status})`
    );
  }

  return await res.json();
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to delete Google Calendar event (${res.status})`
    );
  }
}

export async function syncTaskToGoogle(
  accessToken: string,
  task: PlannedTask,
  subjectName?: string
): Promise<{ eventId: string; htmlLink?: string }> {
  const summary = `📚 [Vega] ${task.title}${subjectName ? ` (${subjectName})` : ''}`;
  const description = [
    `Vega Core Planned Study Task`,
    `Subject: ${subjectName || 'General'}`,
    `Priority: ${task.priority.toUpperCase()}`,
    `Duration: ${task.duration} min`,
    `Status: ${task.done ? 'COMPLETED' : 'PENDING'}`,
    task.notes ? `\nNotes:\n${task.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (task.googleEventId) {
    try {
      const updated = await updateGoogleCalendarEvent(accessToken, task.googleEventId, {
        summary,
        description,
        date: task.date,
        time: task.time,
        durationMinutes: task.duration,
      });
      return { eventId: updated.id, htmlLink: updated.htmlLink };
    } catch (err: any) {
      // If event was deleted in calendar, recreate
      console.warn('Could not update existing event, creating fresh:', err);
    }
  }

  const created = await createGoogleCalendarEvent(accessToken, {
    summary,
    description,
    date: task.date,
    time: task.time,
    durationMinutes: task.duration,
  });

  return { eventId: created.id, htmlLink: created.htmlLink };
}
