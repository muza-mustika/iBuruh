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
    const { session_id, filter_hash, filter_params, worker_ids } = body;

    if (!session_id || !filter_hash || !worker_ids || !Array.isArray(worker_ids)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db.prepare('DELETE FROM temporary_bookings WHERE session_id = ?').bind(session_id).run();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    for (const workerId of worker_ids) {
      try {
        await db.prepare(
          `INSERT INTO temporary_bookings (worker_id, user_id, session_id, filter_hash, filter_params, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(workerId, session_id, session_id, filter_hash, JSON.stringify(filter_params), expiresAt).run();
      } catch (_) { /* already locked */ }
    }

    const lockedWorkers = await db.prepare(
      'SELECT worker_id FROM temporary_bookings WHERE session_id = ?'
    ).bind(session_id).all();

    const lockedIds: number[] = (lockedWorkers.results ?? []).map((w: any) => w.worker_id);

    if (lockedIds.length === 0) {
      return new Response(JSON.stringify({
        success: false, locked_workers: [], expires_at: expiresAt, nano_id: null,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    const nanoId = Array.from(bytes).map(b => chars[b % chars.length]).join('');

    const placeholders = lockedIds.map(() => '?').join(',');
    const workerRows = await db.prepare(
      `SELECT id, hourly_rate FROM workers WHERE id IN (${placeholders})`
    ).bind(...lockedIds).all();

    const duration = parseInt(filter_params?.duration ?? '8');
    const totalPrice = (workerRows.results ?? []).reduce((sum: number, w: any) => sum + (w.hourly_rate * duration), 0);

    const startTime = filter_params?.startTime ?? '08:00';
    const [sh, sm] = startTime.split(':').map(Number);
    const totalMin = sh * 60 + sm + duration * 60;
    const endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2,'0')}:${String(totalMin % 60).padStart(2,'0')}`;

    let nanoIdToReturn: string | null = nanoId;
    try {
      await db.prepare(
        `UPDATE pending_transactions SET status = 'expired' WHERE session_id = ? AND status = 'pending'`
      ).bind(session_id).run();

      await db.prepare(
        `INSERT INTO pending_transactions
           (nano_id, session_id, worker_ids, booking_date, start_time, end_time,
            duration_hours, skill_category, skill_subcategory, total_price, filter_hash, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        nanoId, session_id,
        JSON.stringify(lockedIds),
        filter_params?.date ?? '',
        startTime, endTime, duration,
        filter_params?.skillCategory ?? '',
        filter_params?.skillSubcategory ?? '',
        totalPrice, filter_hash, expiresAt
      ).run();
    } catch (e) {
      console.error('pending_transaction non-fatal:', e);
      nanoIdToReturn = null;
    }

    return new Response(JSON.stringify({
      success: true,
      locked_workers: lockedIds,
      expires_at: expiresAt,
      nano_id: nanoIdToReturn,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error locking workers', detail: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
