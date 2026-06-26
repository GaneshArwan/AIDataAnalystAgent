import { NextRequest, NextResponse } from 'next/server';
import { graph } from '@/lib/agent/graph';
import { isSafeUrl, sanitizeErrorMessage, checkRateLimit, getClientIp } from '@/lib/serverUtils';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Allow up to 30 requests per minute per IP to prevent DoS
    if (!checkRateLimit(ip, 30, 60000)) {
      console.warn(`[SECURITY_ALERT] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { question, dbUrl, provider, apiKey, model, baseUrl } = await req.json().catch(() => ({}));

    if (!question || typeof question !== 'string' || question.length > 5000) {
      return NextResponse.json({ error: 'Valid Question (max 5000 chars) is required' }, { status: 400 });
    }
    if (!dbUrl || typeof dbUrl !== 'string' || dbUrl.length > 2000) {
      return NextResponse.json({ error: 'Valid Database URL is required in BYOK mode' }, { status: 400 });
    }

    // SSRF protection checks
    if (dbUrl && !(await isSafeUrl(dbUrl))) {
      console.warn(`[SECURITY_ALERT] Blocked SSRF attempt to private/untrusted Database URL.`);
      return NextResponse.json({ error: 'Security Violation: Database URL points to an untrusted or private network host.' }, { status: 400 });
    }
    if (baseUrl && !(await isSafeUrl(baseUrl))) {
      console.warn(`[SECURITY_ALERT] Blocked SSRF attempt to private/untrusted Base URL.`);
      return NextResponse.json({ error: 'Security Violation: Base URL points to an untrusted or private network host.' }, { status: 400 });
    }

    console.info(`[AUDIT] Initiating agent execution for user query.`);

    const initialState = {
      userQuestion: question,
      retryCount: 0,
      queryResults: [],
      analysisText: '',
      dbUrl,
      provider,
      apiKey,
      model,
      baseUrl
    };

    const finalState = await graph.invoke(initialState);

    console.info(`[AUDIT] Agent execution completed successfully.`);

    return NextResponse.json({
      queryResults: finalState.queryResults,
      analysisText: finalState.analysisText,
      chartConfigs: finalState.chartConfigs,
      generatedSql: finalState.generatedSql,
      errorMsg: finalState.errorMsg ? sanitizeErrorMessage(finalState.errorMsg) : undefined,
      trace: finalState.trace,
    });
  } catch (error: any) {
    const sanitizedMsg = sanitizeErrorMessage(error.message);
    // Sanitize console logging to avoid leaking potential credentials in error objects
    console.error('Agent execution failed. Error message:', sanitizedMsg); 
    return NextResponse.json({ error: sanitizedMsg }, { status: 500 });
  }
}

