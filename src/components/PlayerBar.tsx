import { useEffect, useRef, useState } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type { PreviewTrack } from '../App';

interface PlayerBarProps {
  track: PreviewTrack | null;
  onStop: () => void;
}

export function PlayerBar({ track, onStop }: PlayerBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime / (audio.duration || 1));
    };
    const handleEnded = () => {
      setIsPlaying(false);
      invoke('preview_stop').catch(console.error);
      onStop();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onStop]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!track) {
      // Track cleared: stop audio and cleanup
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
      setProgress(0);
      setIsLoading(false);
      invoke('preview_stop').catch(console.error);
      return;
    }

    // New track: start preview download
    setIsLoading(true);
    setIsPlaying(false);
    setProgress(0);
    audio.pause();
    audio.src = '';

    invoke<string>('preview_start', {
      videoId: track.id,
      videoUrl: track.audioUrl,
    })
      .then((path) => {
        const assetUrl = convertFileSrc(path);
        audio.src = assetUrl;
        audio.play().catch(console.error);
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Preview failed:', err);
        setIsLoading(false);
      });
  }, [track]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const isActive = track !== null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '48px',
        background: isActive ? 'rgba(183, 223, 255, 0.8)' : 'var(--color-pink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isActive ? 'flex-start' : 'center',
        padding: isActive ? '0 16px' : '0',
        gap: '12px',
        boxSizing: 'border-box',
        borderTop: 'var(--border-style)',
      }}
    >
      {!isActive && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: 'var(--color-pink-dark)',
            opacity: 0.5,
          }}
        >
          ~ no track playing ~
        </span>
      )}

      {isActive && isLoading && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: 'var(--color-pink-dark)',
          }}
        >
          ~ loading preview... ~
        </span>
      )}

      {isActive && !isLoading && (
        <>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '20px',
              color: 'var(--color-blue-dark)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {track?.title}
          </span>

          <button
            type="button"
            onClick={handlePlayPause}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              background: 'var(--color-pink-dark)',
              color: 'white',
              padding: '4px 10px',
              border: 'none',
              boxShadow: 'none',
              flexShrink: 0,
            }}
          >
            {isPlaying ? '\u25A0' : '\u25B6'}
          </button>

          <div
            style={{
              flex: '0 0 120px',
              height: '6px',
              background: 'var(--color-white)',
              border: '1px solid var(--color-pink-dark)',
              borderRadius: '0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: '100%',
                background: 'var(--color-pink-dark)',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
