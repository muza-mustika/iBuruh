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
    const { session_id, batches } = body;

    if (!session_id || !batches || !Array.isArray(batches) || batches.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields (session_id, batches[])' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Release all previous locks + expire old pending transactions for this session
    await db.prepare('DELETE FROM temporary_bookings WHERE session_id = ?').bind(session_id).run();
    await db.prepare(`UPDATE pending_transactions SET status = 'expired' WHERE session_id = ? AND status = 'pending'`).bind(session_id).run();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Collect all unique worker IDs across all batches for locking
    const allWorkerIds = new Set<number>();
    batches.forEach((b: any) => (b.worker_ids ?? []).forEach((id: number) => allWorkerIds.add(id)));

    // Lock all workers in temporary_bookings
    const lockedIds: number[] = [];
    for (const workerId of allWorkerIds) {
      try {
        await db.prepare(
          `INSERT INTO temporary_bookings (worker_id, user_id, session_id, filter_hash, filter_params, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(workerId, session_id, session_id, 'multi-batch', JSON.stringify(batches), expiresAt).run();
        lockedIds.push(workerId);
      } catch (_) { /* already locked by another session */ }
    }

    if (lockedIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        nano_id: null,
        message: 'Semua buruh sudah dipesan oleh user lain',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Build storage batches: expand multi-date into per-date entries
    // and compute prices
    const batchesForStorage: any[] = [];
    let totalPrice = 0;

    for (const batch of batches) {
      const fp = batch.filter_params ?? {};
      const duration = parseInt(fp.duration ?? '8');
      const startTime = fp.startTime ?? '08:00';
      const [sh, sm] = startTime.split(':').map(Number);
      const totalMin = sh * 60 + sm + duration * 60;
      const endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;

      // Only use workers that got locked
      const batchWorkerIds: number[] = (batch.worker_ids ?? []).filter((id: number) => lockedIds.includes(id));
      if (batchWorkerIds.length === 0) continue;

      // Get rates for price calc
      const phs = batchWorkerIds.map(() => '?').join(',');
      const workerRows = await db.prepare(`SELECT id, hourly_rate FROM workers WHERE id IN (${phs})`).bind(...batchWorkerIds).all();
      const rateMap: Record<number, number> = {};
      (workerRows.results ?? []).forEach((w: any) => { rateMap[w.id] = w.hourly_rate; });

      // Each selected date becomes a separate sub-booking
      const dates: string[] = fp.dates?.length > 0 ? fp.dates : (fp.date ? [fp.date] : []);
      for (const date of dates) {
        const batchPrice = batchWorkerIds.reduce((sum, id) => sum + (rateMap[id] ?? 0) * duration, 0);
        totalPrice += batchPrice;
        batchesForStorage.push({
          worker_ids: batchWorkerIds,
          booking_date: date,
          start_time: startTime,
          end_time: endTime,
          duration_hours: duration,
          skill_category: fp.skillCategory ?? '',
          skill_subcategory: fp.skillSubcategory ?? '',
          total_price: batchPrice,
          filter_hash: batch.filter_hash ?? '',
        });
      }
    }

    if (batchesForStorage.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        nano_id: null,
        message: 'Tidak ada batch valid untuk dikunci',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Generate ONE nano_id for the whole transaction
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    const nanoId = Array.from(bytes).map(b => chars[b % chars.length]).join('');

    // Use first batch for legacy columns (backward compat)
    const first = batchesForStorage[0];

    await db.prepare(
      `INSERT INTO pending_transactions
         (nano_id, session_id, worker_ids, booking_date, start_time, end_time,
          duration_hours, skill_category, skill_subcategory, total_price, filter_hash,
          batches_json, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      nanoId, session_id,
      JSON.stringify(lockedIds),
      first.booking_date, first.start_time, first.end_time,
      first.duration_hours, first.skill_category, first.skill_subcategory,
      totalPrice, first.filter_hash,
      JSON.stringify(batchesForStorage),
      expiresAt
    ).run();

    return new Response(JSON.stringify({
      success: true,
      nano_id: nanoId,
      expires_at: expiresAt,
      total_price: totalPrice,
      batch_count: batchesForStorage.length,
      locked_worker_count: lockedIds.length,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error locking workers', detail: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
