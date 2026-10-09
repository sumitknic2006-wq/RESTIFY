export function normalizeApiUrl(value) {
  const unwrapped = value.trim().replace(/^["'`]+|["'`]+$/g, '');
  if (
    !/^https?:\/\//i.test(unwrapped) ||
    /[\s"'`]/.test(unwrapped)
  ) {
    throw new Error('VITE_API_URL must be an absolute HTTP(S) URL without quotes.');
  }

  const parsed = new URL(unwrapped);
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error('VITE_API_URL must include a valid host and no credentials.');
  }

  return unwrapped.replace(/\/+$/, '');
}
