import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = (locals.runtime?.env as any)?.DB ?? (locals as any).env?.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { worker_id, session_id, booking_date, start_time, end_time, duration_hours, total_price, filter_hash } = body;

    if (!worker_id || !session_id || !booking_date || !start_time || !end_time || !duration_hours) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const existingBooking = await db.prepare(
      `SELECT * FROM bookings WHERE worker_id = ? AND booking_date = ? AND status IN ('pending', 'confirmed')
       AND ((start_time <= ? AND end_time >= ?) OR (start_time >= ? AND start_time < ?) OR (end_time > ? AND end_time <= ?))`
    ).bind(worker_id, booking_date, start_time, start_time, start_time, end_time, start_time, end_time).first();

    if (existingBooking) {
      return new Response(JSON.stringify({ error: 'Worker is no longer available' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await db.prepare(
      `INSERT INTO bookings (worker_id, user_id, booking_date, start_time, end_time, duration_hours, total_price, session_id, filter_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(worker_id, session_id, booking_date, start_time, end_time, duration_hours, total_price || 0, session_id, filter_hash || '').run();

    await db.prepare('DELETE FROM temporary_bookings WHERE worker_id = ? AND session_id = ?').bind(worker_id, session_id).run();

    return new Response(JSON.stringify({ success: true, booking_id: result.meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error creating booking', detail: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async ({ request, locals }) => {
  const db = (locals.runtime?.env as any)?.DB ?? (locals as any).env?.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const session_id = url.searchParams.get('session_id');

  try {
    let query = 'SELECT b.*, w.name as worker_name, w.skill_category, w.skill_subcategory, w.hourly_rate FROM bookings b JOIN workers w ON b.worker_id = w.id';
    const params: string[] = [];

    if (session_id) {
      query += ' WHERE b.session_id = ?';
      params.push(session_id);
    }
    query += ' ORDER BY b.created_at DESC';

    const stmt = params.length > 0 ? db.prepare(query).bind(...params) : db.prepare(query);
    const bookings = await stmt.all();
    return new Response(JSON.stringify(bookings.results ?? []), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error fetching bookings', detail: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
