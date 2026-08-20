/** Default shared booking chart (view access). Override with BOOKING_GOOGLE_SHEETS_ID. */
export const DEFAULT_GOOGLE_SHEETS_ID = '13SZlTcgHOrZuD7L9EnSnjADz-3dRbT6C-99Lrz9w6EM';

export function getGoogleSheetsId(): string {
  const fromEnv = process.env.BOOKING_GOOGLE_SHEETS_ID?.trim();
  if (fromEnv) return fromEnv;

  const url = process.env.BOOKING_GOOGLE_SHEETS_URL?.trim();
  if (url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
  }

  return DEFAULT_GOOGLE_SHEETS_ID;
}

export function googleSheetsExportUrl(sheetId: string, cacheBust = true): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
  // Bust Google/CDN caches — without this, Vercel often keeps an older .xlsx after sheet edits.
  return cacheBust ? `${base}&t=${Date.now()}&r=${Math.random().toString(36).slice(2)}` : base;
}

/**
 * Download the shared Google Sheet / Drive workbook as .xlsx bytes.
 * Works with "anyone with the link can view" sharing.
 */
export async function downloadGoogleSheetXlsx(sheetId = getGoogleSheetsId()): Promise<Buffer> {
  const url = googleSheetsExportUrl(sheetId);
  const res = await fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  if (!res.ok) {
    throw new Error(`Google Sheets download failed (${res.status} ${res.statusText}) for ${sheetId}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const buffer = Buffer.from(await res.arrayBuffer());

  if (
    contentType.includes('text/html') ||
    buffer.length < 100 ||
    buffer.subarray(0, 15).toString('utf8').includes('<!DOCTYPE') ||
    buffer.subarray(0, 15).toString('utf8').includes('<html')
  ) {
    throw new Error(
      'Google Sheets returned HTML instead of Excel. Check that the file is shared as "Anyone with the link can view".',
    );
  }

  // XLSX files start with PK (zip)
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error('Downloaded file is not a valid .xlsx workbook.');
  }

  return buffer;
}
