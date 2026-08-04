import { getGoogleAccessToken } from "../utils/googleServiceAccount";
import { extractDriveId, extractYoutubeId } from "../utils/linkIds";

export interface DriveLinkCheck {
  ok: boolean;
  reason: "ok" | "unrecognized_url" | "not_shared" | "upstream_error";
  message: string;
  file_id: string | null;
  name: string | null;
  mime_type: string | null;
  is_folder: boolean | null;
}

export interface YoutubeLinkCheck {
  ok: boolean;
  reason: "ok" | "unrecognized_url" | "private_or_removed" | "upstream_error";
  message: string;
  video_id: string | null;
  title: string | null;
  author_name: string | null;
  thumbnail_url: string | null;
}

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Checks whether a Drive file or folder is readable by someone outside
 * the team.
 *
 * The service account is an unrelated identity, so it stands in exactly
 * for a judge opening the link: if it can read the file, "anyone with
 * the link" is on. Drive answers 404 rather than 403 for files you lack
 * access to — it won't confirm a file exists to someone who can't see it
 * — so "restricted" and "wrong id" are indistinguishable here, and both
 * mean the same thing to the team: fix the link.
 */
export async function verifyDriveLink(
  url: string,
  env: { GOOGLE_SERVICE_ACCOUNT_EMAIL: string; GOOGLE_PRIVATE_KEY: string },
): Promise<DriveLinkCheck> {
  const base: DriveLinkCheck = {
    ok: false,
    reason: "unrecognized_url",
    message: "",
    file_id: null,
    name: null,
    mime_type: null,
    is_folder: null,
  };

  const fileId = extractDriveId(url);
  if (!fileId) {
    return {
      ...base,
      message:
        "That doesn't look like a Google Drive or Google Docs link. Paste the link from the browser address bar.",
    };
  }

  let token: string;
  try {
    token = await getGoogleAccessToken({
      serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: env.GOOGLE_PRIVATE_KEY,
      scope: "https://www.googleapis.com/auth/drive.metadata.readonly",
    });
  } catch (error) {
    console.error("Drive link check — token error:", error);
    return {
      ...base,
      reason: "upstream_error",
      message: "Couldn't check the link right now. Try again in a moment.",
      file_id: fileId,
    };
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
      "?fields=id,name,mimeType&supportsAllDrives=true",
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (response.status === 404) {
    return {
      ...base,
      reason: "not_shared",
      message:
        "This link isn't shared. Open it in Drive, choose Share, and set General access to 'Anyone with the link'.",
      file_id: fileId,
    };
  }

  if (!response.ok) {
    // 403 accessNotConfigured means the Drive API isn't enabled on the
    // Cloud project — a deploy problem, not the team's link.
    const body = await response.text();
    console.error("Drive link check — API error:", response.status, body);
    return {
      ...base,
      reason: "upstream_error",
      message: "Couldn't check the link right now. Try again in a moment.",
      file_id: fileId,
    };
  }

  const file = (await response.json()) as {
    id: string;
    name: string;
    mimeType: string;
  };
  const isFolder = file.mimeType === DRIVE_FOLDER_MIME;

  return {
    ok: true,
    reason: "ok",
    message: isFolder
      ? `Folder "${file.name}" is shared and readable.`
      : `"${file.name}" is shared and readable.`,
    file_id: file.id,
    name: file.name,
    mime_type: file.mimeType,
    is_folder: isFolder,
  };
}

/**
 * Checks whether a YouTube video is playable by someone with the link.
 *
 * Uses oEmbed, which needs no API key and answers the question that
 * matters: can a judge watch this. It cannot tell public from unlisted —
 * both are watchable by link, so both come back ok. Private, deleted and
 * bad ids all fail.
 */
export async function verifyYoutubeLink(url: string): Promise<YoutubeLinkCheck> {
  const base: YoutubeLinkCheck = {
    ok: false,
    reason: "unrecognized_url",
    message: "",
    video_id: null,
    title: null,
    author_name: null,
    thumbnail_url: null,
  };

  const videoId = extractYoutubeId(url);
  if (!videoId) {
    return {
      ...base,
      message:
        "That doesn't look like a YouTube link. Use the Share link, or the URL from the address bar.",
    };
  }

  const oembedUrl =
    "https://www.youtube.com/oembed?format=json&url=" +
    encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);

  let response: Response;
  try {
    response = await fetch(oembedUrl);
  } catch (error) {
    console.error("YouTube link check — fetch error:", error);
    return {
      ...base,
      reason: "upstream_error",
      message: "Couldn't check the link right now. Try again in a moment.",
      video_id: videoId,
    };
  }

  // 401 private, 404 removed, 400 malformed or unknown id.
  if ([400, 401, 403, 404].includes(response.status)) {
    return {
      ...base,
      reason: "private_or_removed",
      message:
        "This video can't be played from the link. Set its visibility to Unlisted or Public, and check it isn't deleted.",
      video_id: videoId,
    };
  }

  if (!response.ok) {
    console.error("YouTube link check — oEmbed error:", response.status);
    return {
      ...base,
      reason: "upstream_error",
      message: "Couldn't check the link right now. Try again in a moment.",
      video_id: videoId,
    };
  }

  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  return {
    ok: true,
    reason: "ok",
    message: `"${data.title ?? "Video"}" is playable.`,
    video_id: videoId,
    title: data.title ?? null,
    author_name: data.author_name ?? null,
    thumbnail_url: data.thumbnail_url ?? null,
  };
}
