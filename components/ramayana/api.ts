export async function ramayanaApi(path = '', body?: Record<string, unknown>, token?: string) {
  const response = await fetch(`/api/ramayana${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(12000), headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Could not connect. Please try again.'), { status: response.status });
  return data;
}
