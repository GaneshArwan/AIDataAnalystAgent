import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { isSafeUrl, sanitizeErrorMessage, checkRateLimit, getClientIp } from '@/lib/serverUtils';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Allow up to 30 requests per minute per IP for health check to prevent DoS
    if (!checkRateLimit(ip, 30, 60000)) {
      console.warn(`[SECURITY_ALERT] Health check rate limit exceeded for IP: ${ip}`);
      return NextResponse.json({ status: 'disconnected', error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const dbUrl = body.dbUrl;

    if (!dbUrl || typeof dbUrl !== 'string' || dbUrl.length > 2000) {
      return NextResponse.json({ status: 'missing_env' }, { status: 200 });
    }

    // SSRF protection check
    if (dbUrl && !(await isSafeUrl(dbUrl))) {
      console.warn(`[SECURITY_ALERT] Blocked health check SSRF attempt to private/untrusted Database URL.`);
      return NextResponse.json({ status: 'disconnected', error: 'Security Violation: Database URL points to an untrusted or private network host.' }, { status: 200 });
    }

    console.info(`[AUDIT] Initiating database health check.`);
    
    // Attempt a simple lightweight query to verify connection
    const db = getDb(dbUrl);
    await db.execute(sql`SELECT 1`);

    console.info(`[AUDIT] Database health check passed.`);
    
    return NextResponse.json({ status: 'connected' }, { status: 200 });
  } catch (error: any) {
    const sanitizedMsg = sanitizeErrorMessage(error.message);
    // Sanitize console logging to avoid leaking potential credentials in error objects
    console.error('Database Health Check Failed. Error message:', sanitizedMsg);
    return NextResponse.json({ status: 'disconnected', error: sanitizedMsg }, { status: 200 });
  }
}

