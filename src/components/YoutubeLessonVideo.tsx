import { useState } from 'react';
import { CheckCircle2, CirclePlay, ExternalLink, MonitorPlay } from 'lucide-react';
import type { LessonVideo } from '../data/types';
import { parseYoutubeId, youtubeEmbedUrl, youtubeWatchUrl } from '../services/youtube';
import { Badge, Card, ProgressBar } from './ui';

/** "12:45" or "1:02:30" → seconds, used for the YouTube start parameter. */
export function parseTimestamp(value: string): number {
  const parts = value.split(':').map(part => Number.parseInt(part, 10));
  if (parts.some(part => Number.isNaN(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/**
 * Reusable YouTube teaching player.
 *
 * Every module has its own teaching video (see data/lessons.ts). The component only needs
 * the video id — a bare id or a full YouTube URL both work — so swapping in your own video
 * is a one-line data change; the iframe is never hard-coded into a page.
 *
 *   <YoutubeLessonVideo videoId="…" title="Understanding Superposition" duration="12:45" />
 */
export function YoutubeLessonVideo({
  videoId,
  title,
  duration,
  summary,
  chapters = [],
  watched = false,
  onMarkWatched,
  onWatchOnYoutube,
}: {
  videoId: string;
  title: string;
  duration?: string;
  summary?: string;
  chapters?: LessonVideo['chapters'];
  watched?: boolean;
  onMarkWatched?: () => void;
  /** Optional: lets the lesson page open the player in a new tab instead of an iframe. */
  onWatchOnYoutube?: () => void;
}) {
  const [activeChapter, setActiveChapter] = useState(0);
  // Accepts a bare id or a full URL, so a pasted link appears here without editing it.
  const resolvedId = parseYoutubeId(videoId);
  const configured = resolvedId !== null;
  const chapter = chapters[activeChapter];
  const start = chapter ? parseTimestamp(chapter.at) : 0;
  const watchUrl = resolvedId ? youtubeWatchUrl(resolvedId) : '';
  const embedSrc = resolvedId ? youtubeEmbedUrl(resolvedId, start) : '';

  return (
    <Card
      title="Watch & Learn"
      subtitle="A guided walkthrough of this module — watch it before the experiment"
      actions={
        <>
          <Badge tone={watched ? 'good' : 'default'}>
            {watched ? 'watched' : duration ? `video · ${duration}` : 'not watched'}
          </Badge>
          <a
            className={`btn-small btn${configured ? '' : ' disabled'}`}
            href={configured ? watchUrl : undefined}
            target="_blank"
            rel="noreferrer noopener"
            aria-disabled={!configured}
            onClick={event => {
              if (!configured) event.preventDefault();
              onWatchOnYoutube?.();
            }}
          >
            <ExternalLink size={13} /> Watch on YouTube
          </a>
        </>
      }
    >
      <div className="video-shell">
        {configured ? (
          <iframe
            className="video-frame"
            src={embedSrc}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="video-placeholder" role="img" aria-label="Teaching video not added yet">
            <MonitorPlay size={40} aria-hidden />
            <strong>{title}</strong>
            <p className="small muted">
              The teaching video for this module is not in place yet. Everything else in the lesson works
              without it: read the concept, run the experiment, then take the quiz.
            </p>
            <p className="tiny dim" style={{ margin: 0 }}>
              Author note: set <code>videoId</code> for this module in <code>src/data/lessons.ts</code> — a bare
              id or a full YouTube URL both work — and the player takes this slot.
            </p>
          </div>
        )}
      </div>

      <div className="row between" style={{ marginTop: 12 }}>
        <div>
          <strong className="small">{title}</strong>
          <div className="tiny dim">
            {chapters.length} chapters · {duration ?? 'duration pending'}
          </div>
        </div>
        <div className="row tight">
          <button className="btn-small" onClick={onMarkWatched} disabled={watched || !onMarkWatched}>
            {watched ? (
              <>
                <CheckCircle2 size={13} /> Watched
              </>
            ) : (
              <>
                <CirclePlay size={13} /> Mark as watched
              </>
            )}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <ProgressBar
          value={watched ? 100 : chapters.length ? (activeChapter / chapters.length) * 100 : 0}
          label="Video progress"
          hint={watched ? 'complete' : chapter ? `at ${chapter.at}` : 'not started'}
        />
      </div>

      {chapters.length > 0 && (
        <ol className="chapter-list">
          {chapters.map((entry, index) => (
            <li key={entry.at}>
              <button
                className={`chapter${index === activeChapter ? ' active' : ''}`}
                onClick={() => setActiveChapter(index)}
                title={configured ? `Jump to ${entry.at}` : 'Chapter timings are ready for your video'}
              >
                <span className="mono tiny">{entry.at}</span>
                <span className="small">{entry.label}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {summary && (
        <div className="callout" style={{ marginTop: 12 }}>
          <div className="tiny dim" style={{ marginBottom: 4 }}>
            What this video covers
          </div>
          <p className="small" style={{ margin: 0 }}>
            {summary}
          </p>
        </div>
      )}
    </Card>
  );
}
