import { VIDEO_PLACEHOLDER } from '../data/lessons';

/**
 * YouTube helpers.
 *
 * Lesson data may hold either a bare video id (`dQw4w9WgXcQ`) or a full URL pasted straight
 * from the browser — `youtu.be/…`, `watch?v=…`, `/embed/…`, `/shorts/…`, `/live/…`,
 * with or without extra query parameters. Everything is normalised here so the player only
 * ever deals with an id, and swapping in a real video stays a data edit.
 */

/** A YouTube id is 11 characters today, but accept a sane range rather than hard-coding it. */
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const URL_PATTERNS = [
  /youtu\.be\/([A-Za-z0-9_-]{8,64})/i,
  /[?&]v=([A-Za-z0-9_-]{8,64})/i,
  /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{8,64})/i,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{8,64})/i,
  /youtube\.com\/live\/([A-Za-z0-9_-]{8,64})/i,
];

/** Extracts a video id, or returns null when nothing usable was supplied. */
export function parseYoutubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value || value === VIDEO_PLACEHOLDER) return null;
  if (ID_PATTERN.test(value)) return value;
  for (const pattern of URL_PATTERNS) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** True when the data holds a real video rather than the placeholder. */
export function hasYoutubeVideo(input: string | null | undefined): boolean {
  return parseYoutubeId(input) !== null;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Privacy-preserving embed URL (youtube-nocookie) with an optional start offset. */
export function youtubeEmbedUrl(videoId: string, startSeconds = 0): string {
  const start = startSeconds > 0 ? `&start=${startSeconds}` : '';
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1${start}`;
}
