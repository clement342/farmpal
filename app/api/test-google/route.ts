/**
 * GET /api/test-google
 * Temporary diagnostic endpoint — tests Google AI Studio connectivity.
 * DELETE THIS FILE after the cloud provider is confirmed working.
 */
import { NextResponse } from 'next/server';

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
  'gemini-flash-latest',
];

const BODY = JSON.stringify({
  contents: [{ parts: [{ text: 'Reply with the single word: ok' }] }],
});

export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_API_KEY not set' }, { status: 500 });
  }

  const results: Record<string, unknown> = {
    keyPrefix: apiKey.substring(0, 6),
    keyLength: apiKey.length,
  };

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: BODY,
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text();
      results[model] = { status: res.status, body: text.slice(0, 300) };
    } catch (err) {
      results[model] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
