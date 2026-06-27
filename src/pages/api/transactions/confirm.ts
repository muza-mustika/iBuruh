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

    // Decide: use new multi-batch format or legacy single-batch format
    const batchesRaw = (pending as any).batches_json;
    const batches: any[] = batchesRaw ? JSON.parse(batchesRaw) : [{
      worker_ids: JSON.parse((pending as any).worker_ids ?? '[]'),
      booking_date: (pending as any).booking_date,
      start_time: (pending as any).start_time,
      end_time: (pending as any).end_time,
      duration_hours: (pending as any).duration_hours,
      skill_category: (pending as any).skill_category,
      skill_subcategory: (pending as any).skill_subcategory,
      total_price: (pending as any).total_price,
      filter_hash: (pending as any).filter_hash,
    }];

    // Pre-check conflicts for all (worker, date, time) combos
    const conflicts: string[] = [];
    for (const batch of batches) {
      for (const workerId of (batch.worker_ids ?? [])) {
        const existing = await db.prepare(
          `SELECT id FROM bookings WHERE worker_id = ? AND booking_date = ? AND status IN ('pending','confirmed')
           AND ((start_time <= ? AND end_time >= ?) OR (start_time >= ? AND start_time < ?) OR (end_time > ? AND end_time <= ?))`
        ).bind(
          workerId, batch.booking_date,
          batch.start_time, batch.start_time,
          batch.start_time, batch.end_time,
          batch.start_time, batch.end_time
        ).first();
        if (existing) conflicts.push(`worker ${workerId} tgl ${batch.booking_date}`);
      }
    }

    if (conflicts.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        message: `Konflik: ${conflicts.length} slot sudah dipesan oleh user lain`,
        conflicts,
      }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    // Create bookings for all batches
    const bookingIds: number[] = [];
    let totalConfirmed = 0;

    for (const batch of batches) {
      const workerIds: number[] = batch.worker_ids ?? [];
      if (workerIds.length === 0) continue;

      // Get worker rates
      const phs = workerIds.map(() => '?').join(',');
      const workerRows = await db.prepare(`SELECT id, hourly_rate FROM workers WHERE id IN (${phs})`).bind(...workerIds).all();
      const rateMap: Record<number, number> = {};
      (workerRows.results ?? []).forEach((w: any) => { rateMap[w.id] = w.hourly_rate; });

      for (const workerId of workerIds) {
        const price = (rateMap[workerId] ?? 0) * batch.duration_hours;
        try {
          const result = await db.prepare(
            `INSERT INTO bookings
               (worker_id, user_id, booking_date, start_time, end_time,
                duration_hours, total_price, session_id, filter_hash, nano_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
          ).bind(
            workerId, (pending as any).session_id,
            batch.booking_date, batch.start_time, batch.end_time,
            batch.duration_hours, price,
            (pending as any).session_id, batch.filter_hash, nano_id
          ).run();
          bookingIds.push(result.meta.last_row_id);
          totalConfirmed++;
        } catch (e) {
          console.error(`booking worker ${workerId} tgl ${batch.booking_date} failed:`, e);
        }
      }
    }

    // Mark pending transaction confirmed
    await db.prepare(`UPDATE pending_transactions SET status = 'confirmed' WHERE nano_id = ?`).bind(nano_id).run();

    // Release temporary locks
    await db.prepare(`DELETE FROM temporary_bookings WHERE session_id = ?`).bind((pending as any).session_id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Transaksi berhasil dikonfirmasi',
      booking_ids: bookingIds,
      total_bookings: totalConfirmed,
      detail: {
        batch_count: batches.length,
        total_price: (pending as any).total_price,
        nano_id,
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
      `SELECT nano_id, booking_date, start_time, end_time, duration_hours,
              skill_category, skill_subcategory, total_price, status, expires_at, batches_json
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
