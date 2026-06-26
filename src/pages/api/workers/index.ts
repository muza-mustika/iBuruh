import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  const db = (locals.runtime?.env as any)?.DB ?? (locals as any).env?.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const datesParam = url.searchParams.get('dates');
  const dateParam  = url.searchParams.get('date');
  const dates = datesParam ? datesParam.split(',').filter(Boolean) : (dateParam ? [dateParam] : []);

  const skillCategory    = url.searchParams.get('skill_category');
  const skillSubcategory = url.searchParams.get('skill_subcategory');
  const startTime        = url.searchParams.get('start_time');
  const duration         = url.searchParams.get('duration');
  const jumlah           = url.searchParams.get('jumlah');

  try {
    let query = 'SELECT * FROM workers WHERE available = 1';
    const params: (string | number)[] = [];

    if (skillCategory) {
      query += ' AND skill_category = ?';
      params.push(skillCategory);
    }
    if (skillSubcategory) {
      query += ' AND skill_subcategory = ?';
      params.push(skillSubcategory);
    }

    if (dates.length > 0 && startTime && duration) {
      const durationHours = parseInt(duration);
      const endTime = calcEndTime(startTime, durationHours);
      const datePlaceholders = dates.map(() => '?').join(',');
      query += ` AND id NOT IN (
        SELECT worker_id FROM bookings
        WHERE booking_date IN (${datePlaceholders})
        AND (
          (start_time <= ? AND end_time >= ?) OR
          (start_time >= ? AND start_time < ?) OR
          (end_time > ? AND end_time <= ?)
        )
        AND status IN ('pending', 'confirmed')
      )`;
      params.push(...dates, startTime, startTime, startTime, endTime, startTime, endTime);
    }

    query += ` AND id NOT IN (
      SELECT worker_id FROM temporary_bookings
      WHERE expires_at > datetime('now')
    )`;

    if (jumlah) {
      query += ' LIMIT ?';
      params.push(parseInt(jumlah));
    }

    const stmt = params.length > 0
      ? db.prepare(query).bind(...params)
      : db.prepare(query);

    const result = await stmt.all();
    return new Response(JSON.stringify(result.results ?? []), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'DB error', detail: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function calcEndTime(startTime: string, hours: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + hours * 60;
  return `${String(Math.floor(total / 60) % 24).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}
