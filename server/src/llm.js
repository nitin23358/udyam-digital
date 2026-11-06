// Thin Gemini REST client. If GEMINI_API_KEY is missing or a call fails/times out,
// callers fall back to deterministic logic — the journey never depends on the LLM being up.
const KEY = () => process.env.GEMINI_API_KEY;
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export const llmEnabled = () => Boolean(KEY());
export const llmInfo = () => ({ enabled: llmEnabled(), provider: llmEnabled() ? 'gemini' : 'rules', model: llmEnabled() ? MODEL() : null });

export async function generate({ system, prompt, json = false, timeoutMs = 12000, temperature = 0.2 }) {
  if (!llmEnabled()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY() },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          ...(json ? { responseMimeType: 'application/json' } : {}),
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      console.warn('[llm] HTTP', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (!json) return text.trim();
    try {
      return JSON.parse(text.replace(/^```json\s*|```$/g, ''));
    } catch {
      return null;
    }
  } catch (e) {
    console.warn('[llm] failed:', e.name === 'AbortError' ? 'timeout' : e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
