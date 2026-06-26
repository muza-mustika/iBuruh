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
    const { nano_id } = body;

    if (!nano_id) {
      return new Response(JSON.stringify({ success: false, message: 'nano_id wajib diisi' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pending = await db.prepare(
      `SELECT * FROM pending_transactions WHERE nano_id = ? AND status = 'pending' AND expires_at > datetime('now')`
    ).bind(nano_id).first();

    if (!pending) {
      return new Response(JSON.stringify({ success: false, message: 'Token tidak ditemukan, sudah digunakan, atau kadaluarsa' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const workerIds: number[] = JSON.parse(pending.worker_ids as string);
    const conflicts: number[] = [];

    for (const workerId of workerIds) {
      const existing = await db.prepare(
        `SELECT id FROM bookings WHERE worker_id = ? AND booking_date = ? AND status IN ('pending','confirmed')
         AND ((start_time <= ? AND end_time >= ?) OR (start_time >= ? AND start_time < ?) OR (end_time > ? AND end_time <= ?))`
      ).bind(workerId, pending.booking_date, pending.start_time, pending.start_time, pending.start_time, pending.end_time, pending.start_time, pending.end_time).first();
      if (existing) conflicts.push(workerId);
    }

    if (conflicts.length > 0) {
      return new Response(JSON.stringify({ success: false, message: `${conflicts.length} buruh sudah dipesan oleh user lain` }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const placeholders = workerIds.map(() => '?').join(',');
    const workerRows = await db.prepare(`SELECT id, hourly_rate FROM workers WHERE id IN (${placeholders})`).bind(...workerIds).all();
    const rateMap: Record<number, number> = {};
    (workerRows.results ?? []).forEach((w: any) => { rateMap[w.id] = w.hourly_rate; });

    const bookingIds: number[] = [];
    for (const workerId of workerIds) {
      const price = (rateMap[workerId] ?? 0) * (pending.duration_hours as number);
      try {
        const result = await db.prepare(
          `INSERT INTO bookings (worker_id, user_id, booking_date, start_time, end_time, duration_hours, total_price, session_id, filter_hash, nano_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
        ).bind(workerId, pending.session_id, pending.booking_date, pending.start_time, pending.end_time, pending.duration_hours, price, pending.session_id, pending.filter_hash, nano_id).run();
        bookingIds.push(result.meta.last_row_id);
      } catch (e) { console.error(`booking worker ${workerId} failed:`, e); }
    }

    await db.prepare(`UPDATE pending_transactions SET status = 'confirmed' WHERE nano_id = ?`).bind(nano_id).run();

    for (const workerId of workerIds) {
      await db.prepare(`DELETE FROM temporary_bookings WHERE worker_id = ? AND session_id = ?`).bind(workerId, pending.session_id).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Transaksi berhasil dikonfirmasi',
      booking_ids: bookingIds,
      detail: {
        booking_date: pending.booking_date,
        skill_category: pending.skill_category,
        skill_subcategory: pending.skill_subcategory,
        duration_hours: pending.duration_hours,
        total_price: pending.total_price,
        worker_count: bookingIds.length,
      },
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: 'Internal server error', detail: String(error) }), {
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
  const nano_id = url.searchParams.get('nano_id');

  if (!nano_id) {
    return new Response(JSON.stringify({ success: false, message: 'nano_id diperlukan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const pending = await db.prepare(
      `SELECT nano_id, booking_date, start_time, end_time, duration_hours, skill_category, skill_subcategory, total_price, status, expires_at
       FROM pending_transactions WHERE nano_id = ?`
    ).bind(nano_id).first();

    if (!pending) {
      return new Response(JSON.stringify({ success: false, message: 'Token tidak ditemukan' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data: pending }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: 'Internal server error', detail: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
