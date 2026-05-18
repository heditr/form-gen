/**
 * Descriptor `file.acceptedFormats` may list **MIME types** (`application/pdf`),
 * **extensions** (`pdf`, `.pdf`), or both. HTML `accept` and client validation must treat them accordingly.
 */

/** Known MIME keys → extensions when {@link File.type} is missing (some browsers). */
const mimeToExtensions: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'text/plain': ['txt'],
};

export interface ParsedAcceptedFormats {
  mimeTypes: string[];
  extensions: string[];
}

/** Lowercases, strips a leading dot, splits MIME tokens vs bare extensions. */
export function parseAcceptedFormatTokens(formats: string[]): ParsedAcceptedFormats {
  const normalized = formats.map((format) => format.trim().toLowerCase().replace(/^\./, ''));
  const mimeTypes = normalized.filter((token) => token.includes('/'));
  const extensions = normalized.filter((token) => !token.includes('/'));
  return { mimeTypes, extensions };
}

/**
 * Builds an `accept` string for `<input type="file">`: MIME tokens unchanged,
 * bare extensions as `.ext`.
 */
export function buildAcceptAttributeFromFormats(formats: string[]): string | undefined {
  if (formats.length === 0) {
    return undefined;
  }
  const { mimeTypes, extensions } = parseAcceptedFormatTokens(formats);
  const parts = [...mimeTypes, ...extensions.map((ext) => `.${ext}`)];
  return parts.join(',');
}

function mimeMatchesListed(fileMime: string, listed: string[]): boolean {
  const lower = fileMime.toLowerCase();
  return listed.some((m) => lower === m || lower.startsWith(`${m};`));
}

/** True when unrestricted (`formats` empty) or the file satisfies MIME and/or extension rules. */
export function fileMatchesAcceptedFormats(file: File, formats: string[]): boolean {
  const { mimeTypes, extensions } = parseAcceptedFormatTokens(formats);
  if (mimeTypes.length === 0 && extensions.length === 0) {
    return true;
  }

  const ext = file.name.includes('.') ? (file.name.split('.').pop()?.toLowerCase() ?? '') : '';

  if (extensions.length > 0 && ext !== '' && extensions.includes(ext)) {
    return true;
  }

  if (mimeTypes.length > 0) {
    const mime = file.type?.trim() ?? '';
    if (mime !== '' && mimeMatchesListed(mime, mimeTypes)) {
      return true;
    }
    if (mime === '' && ext !== '') {
      for (const m of mimeTypes) {
        const allowed = mimeToExtensions[m];
        if (allowed?.includes(ext)) {
          return true;
        }
      }
    }
  }

  return false;
}
