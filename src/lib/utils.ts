/**
 * Utility for combining CSS class names cleanly.
 */
export function cn(...classes: unknown[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Extracts a clean domain hostname from a URL string.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Returns a fallback initial or clean letter for domain icons.
 */
export function getDomainInitial(domain: string): string {
  return domain.replace(/^https?:\/\//, '').charAt(0).toUpperCase();
}
