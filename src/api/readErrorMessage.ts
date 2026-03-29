export async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(' ');
    }
    if (typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    /* not JSON */
  }
  if (text) {
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  }
  return res.statusText || 'Request failed';
}
