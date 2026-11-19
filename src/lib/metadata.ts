import { extractDomain } from './utils';

/**
 * Normalizes a user-entered URL string.
 * Automatically prepends 'https://' if protocol is omitted.
 * Preserves query strings, hashes, and meaningful paths.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  let withProtocol = trimmed;
  // If it starts with //, add https:
  if (withProtocol.startsWith('//')) {
    withProtocol = `https:${withProtocol}`;
  } else if (!/^https?:\/\//i.test(withProtocol)) {
    // If no http:// or https:// protocol, prepend https://
    withProtocol = `https://${withProtocol}`;
  }

  try {
    const parsed = new URL(withProtocol);
    // Ensure protocol is http or https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    // Verify hostname has at least a dot (e.g., example.com) or is localhost
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return '';
    }
    // Remove trailing slash if path is strictly empty root '/'
    if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
      return `${parsed.protocol}//${parsed.host}`;
    }
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * Validates whether an input string represents a valid website URL.
 */
export function isValidUrl(input: string): boolean {
  const normalized = normalizeUrl(input);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname.includes('.') || parsed.hostname === 'localhost') &&
      parsed.hostname.length > 3
    );
  } catch {
    return false;
  }
}

/**
 * Generates a high-resolution Google S2 favicon service URL for a given domain or URL.
 * Free, CDN-cached, fast, and does not require an API key.
 */
export function getFaviconUrl(urlOrDomain: string): string {
  const domain = extractDomain(urlOrDomain);
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/**
 * Generates a clean, human-readable title fallback from the URL hostname and path.
 * Avoids raw unformatted slugs by capitalizing words and stripping extensions.
 */
export function generateFallbackTitle(url: string): string {
  const normalized = normalizeUrl(url);
  if (!normalized) return 'Saved Link';

  try {
    const parsed = new URL(normalized);
    const domain = parsed.hostname.replace(/^www\./, '');
    const pathname = parsed.pathname;

    // 1. Common developer and reading platform specializations
    if (domain === 'github.com') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      if (parts.length === 1) {
        return `${parts[0]} on GitHub`;
      }
      return 'GitHub';
    }

    if (domain === 'news.ycombinator.com') {
      return 'Hacker News';
    }

    if (domain.includes('wikipedia.org')) {
      const parts = pathname.split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== 'wiki') {
        return decodeURIComponent(lastPart).replace(/_/g, ' ');
      }
      return 'Wikipedia';
    }

    if (domain === 'youtube.com' || domain === 'youtu.be') {
      return 'YouTube Video';
    }

    if (domain === 'x.com' || domain === 'twitter.com') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        return `@${parts[0]} on X`;
      }
      return 'X (Twitter)';
    }

    // 2. Extract meaningful slug from URL pathname if present
    const pathSegments = pathname
      .split('/')
      .filter((seg) => seg.length > 0 && !/^\d+$/.test(seg)); // filter empty and pure numeric segments

    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      // Strip common file extensions (.html, .htm, .php, .aspx, .md)
      const cleanSegment = decodeURIComponent(lastSegment)
        .replace(/\.(html?|php|aspx?|md|jsp)$/i, '')
        .replace(/[-_+]/g, ' ')
        .trim();

      if (cleanSegment.length > 2) {
        // Title-case the words
        const titleCased = cleanSegment
          .split(' ')
          .filter(Boolean)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        return titleCased;
      }
    }

    // 3. Fallback to clean domain name with first letter capitalized
    const domainParts = domain.split('.');
    if (domainParts.length >= 2) {
      const brand = domainParts[0];
      return brand.charAt(0).toUpperCase() + brand.slice(1);
    }

    return domain;
  } catch {
    return 'Saved Link';
  }
}

/**
 * Resolves a preview image / thumbnail URL for a given web link.
 * 
 * 1. Checks platforms with official, public, zero-CORS thumbnail endpoints:
 *    - YouTube: Official HQ video thumbnail (img.youtube.com)
 *    - GitHub: Official repository social Open Graph card (opengraph.githubassets.com)
 * 2. Uses WordPress mShots CDN as a reliable, free, keyless fallback preview:
 *    - https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=640
 * 
 * Does not violate browser CORS, requires no API keys, and has no paid service dependencies.
 */
export function getPreviewImageUrl(url: string): string | undefined {
  const normalized = normalizeUrl(url);
  if (!normalized) return undefined;

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // 1. YouTube video thumbnail
    if (hostname === 'youtube.com' || hostname === 'youtu.be' || hostname === 'm.youtube.com') {
      const match = normalized.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/)|youtu\.be\/)([\w-]{11})/i);
      if (match && match[1]) {
        return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      }
    }

    // 2. GitHub repository Open Graph social preview card
    if (hostname === 'github.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        !['features', 'pricing', 'security', 'login', 'signup', 'explore', 'topics', 'settings', 'notifications'].includes(parts[0])
      ) {
        return `https://opengraph.githubassets.com/1/${parts[0]}/${parts[1]}`;
      }
    }

    // 3. WordPress mShots public screenshot CDN
    return `https://s0.wp.com/mshots/v1/${encodeURIComponent(normalized)}?w=640`;
  } catch {
    return undefined;
  }
}

/**
 * Asynchronously attempts to resolve an Open Graph image using the free, keyless Microlink API.
 * Uses an abort timeout so it never blocks or delays the application.
 */
export async function fetchOpenGraphImage(url: string, timeoutMs = 2500): Promise<string | undefined> {
  const normalized = normalizeUrl(url);
  if (!normalized) return undefined;

  // Direct platform handlers take precedence
  const direct = getPreviewImageUrl(normalized);
  if (direct && (direct.includes('youtube.com') || direct.includes('githubassets.com'))) {
    return direct;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(normalized)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const ogImage = data?.data?.image?.url;
      if (ogImage && typeof ogImage === 'string' && ogImage.startsWith('http')) {
        return ogImage;
      }
    }
  } catch {
    // Graceful fallback to default thumbnail URL
  }

  return direct;
}
