import { describe, expect, it } from 'vitest';
import { VIDEO_PLACEHOLDER } from '../data/lessons';
import { hasYoutubeVideo, parseYoutubeId, youtubeEmbedUrl, youtubeWatchUrl } from './youtube';
import { parseTimestamp } from '../components/YoutubeLessonVideo';

describe('parseYoutubeId', () => {
  it('accepts a bare video id', () => {
    expect(parseYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts every URL shape a student might paste', () => {
    expect(parseYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeId('https://youtu.be/dQw4w9WgXcQ?t=75')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseYoutubeId('  youtu.be/dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ');
  });

  it('treats the placeholder and empty input as "no video yet"', () => {
    expect(parseYoutubeId(VIDEO_PLACEHOLDER)).toBeNull();
    expect(parseYoutubeId('')).toBeNull();
    expect(parseYoutubeId('   ')).toBeNull();
    expect(parseYoutubeId(null)).toBeNull();
    expect(parseYoutubeId(undefined)).toBeNull();
    expect(hasYoutubeVideo(VIDEO_PLACEHOLDER)).toBe(false);
    expect(hasYoutubeVideo('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });

  it('rejects text that is not a video reference', () => {
    expect(parseYoutubeId('quantum superposition')).toBeNull();
    expect(parseYoutubeId('https://vimeo.com/12345678')).toBeNull();
    expect(parseYoutubeId('abc')).toBeNull();
  });
});

describe('youtube urls', () => {
  it('builds a watch link and a privacy-preserving embed', () => {
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1',
    );
    expect(youtubeEmbedUrl('dQw4w9WgXcQ', 185)).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&start=185',
    );
  });
});

describe('parseTimestamp', () => {
  it('converts chapter timestamps to seconds', () => {
    expect(parseTimestamp('00:00')).toBe(0);
    expect(parseTimestamp('03:05')).toBe(185);
    expect(parseTimestamp('12:45')).toBe(765);
    expect(parseTimestamp('1:02:30')).toBe(3750);
    expect(parseTimestamp('nonsense')).toBe(0);
  });
});
