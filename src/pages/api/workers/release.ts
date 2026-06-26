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
    const { session_id, filter_hash } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'Missing session_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (filter_hash) {
      await db.prepare(
        'DELETE FROM temporary_bookings WHERE session_id = ? AND filter_hash = ?'
      ).bind(session_id, filter_hash).run();
    } else {
      await db.prepare(
        'DELETE FROM temporary_bookings WHERE session_id = ?'
      ).bind(session_id).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error releasing workers', detail: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
