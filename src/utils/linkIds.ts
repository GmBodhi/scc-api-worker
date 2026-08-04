/**
 * Pulls the resource id out of the URL shapes people actually paste.
 *
 * Both return null rather than throwing — an unrecognised URL is an
 * ordinary answer for a link checker ("we can't read this"), not an
 * exceptional condition.
 */

const DRIVE_PATTERNS = [
  // drive.google.com/file/d/{id}/view
  // docs.google.com/{document,presentation,spreadsheets,forms}/d/{id}/edit
  /\/d\/([a-zA-Z0-9_-]{10,})/,
  // drive.google.com/drive/folders/{id}, /drive/u/0/folders/{id}
  /\/folders\/([a-zA-Z0-9_-]{10,})/,
  // drive.google.com/open?id={id}, ...&id={id}
  /[?&]id=([a-zA-Z0-9_-]{10,})/,
];

export function extractDriveId(url: string): string | null {
  for (const pattern of DRIVE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// YouTube ids are exactly 11 chars; anchoring the length stops the
// patterns from swallowing trailing path or query segments.
const YOUTUBE_PATTERNS = [
  /[?&]v=([a-zA-Z0-9_-]{11})/, // watch?v={id}
  /youtu\.be\/([a-zA-Z0-9_-]{11})/, // youtu.be/{id}
  /\/embed\/([a-zA-Z0-9_-]{11})/, // /embed/{id}
  /\/shorts\/([a-zA-Z0-9_-]{11})/, // /shorts/{id}
  /\/live\/([a-zA-Z0-9_-]{11})/, // /live/{id}
];

export function extractYoutubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
