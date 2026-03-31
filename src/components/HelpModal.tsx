import { useState } from 'react';

interface Props {
  onClose: () => void;
}

type Lang = 'ko' | 'en';

const STEPS = {
  ko: [
    {
      icon: '🔍',
      title: '검색 또는 URL 붙여넣기',
      desc: '곡 이름이나 아티스트로 검색하거나, YouTube URL을 그대로 붙여넣으면 돼. 플레이리스트 URL도 OK!',
    },
    {
      icon: '▶',
      title: '미리 듣기',
      desc: '검색 결과에서 재생 버튼을 누르면 최대 1분 미리 들을 수 있어. 마음에 드는 곡만 골라담자.',
    },
    {
      icon: '🛒',
      title: '큐에 담기',
      desc: '[+] 버튼으로 여러 곡을 장바구니처럼 담아두고, Queue 탭에서 한 방에 다운로드!',
    },
    {
      icon: '💾',
      title: '저장 폴더 지정',
      desc: 'Settings → SAVE TO 에서 저장 폴더를 먼저 정해두면 편해. 안 정하면 기본 폴더에 저장돼.',
    },
  ],
  en: [
    {
      icon: '🔍',
      title: 'Search or Paste URL',
      desc: 'Search by song name or artist, or just paste a YouTube URL directly. Playlist URLs work too!',
    },
    {
      icon: '▶',
      title: 'Preview',
      desc: 'Hit the play button on any result to preview up to 1 minute. Only download what you love~',
    },
    {
      icon: '🛒',
      title: 'Add to Queue',
      desc: 'Use [+] to queue up multiple tracks, then batch-download them all at once from the Queue tab!',
    },
    {
      icon: '💾',
      title: 'Set Save Folder',
      desc: 'Go to Settings → SAVE TO and pick your folder first. If you skip this, files go to the default folder.',
    },
  ],
};

const TIPS = {
  ko: [
    '🐌  다운로드가 느릴 수 있어 — YouTube 서버 상태나 네트워크에 따라 달라져. 기다려줘!',
    '🍪  Sign in 오류가 뜨면 Settings → COOKIE SOURCE 에서 로그인된 브라우저를 선택해봐.',
    '🔑  검색 결과가 적거나 느리면 Settings에서 YouTube API 키를 등록하면 빨라져.',
    '📋  파일명 패턴은 Settings → FILENAME PATTERN 에서 {artist} - {title} 형식으로 커스텀 가능.',
  ],
  en: [
    '🐌  Downloads can be slow — it depends on YouTube server load and your network. Hang tight!',
    '🍪  Getting a Sign in error? Go to Settings → COOKIE SOURCE and select your logged-in browser.',
    '🔑  Slow search results? Add a YouTube Data API key in Settings for faster, richer results.',
    '📋  Customize filenames in Settings → FILENAME PATTERN using {artist} - {title} etc.',
  ],
};

const COPYRIGHT = {
  ko: '⚠️ 저작권 안내 — 이 앱은 개인 소장 목적으로만 사용해줘. 다운로드한 음원의 저작권은 원 저작자에게 있어. 재배포·상업적 이용은 절대 안 돼. 아티스트를 응원하는 마음으로 공식 채널도 함께 이용해줘 ♡',
  en: '⚠️ Copyright Notice — This app is for personal archival use only. Downloaded content remains the property of its original creators. Redistribution or commercial use is strictly prohibited. Please support artists through official channels too ♡',
};

export function HelpModal({ onClose }: Props) {
  const [lang, setLang] = useState<Lang>('ko');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(45, 27, 27, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-white)',
          border: '4px solid var(--color-pink-dark)',
          boxShadow: '8px 8px 0px var(--color-pink-dark)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '24px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: 'var(--color-pink)',
            border: '3px solid var(--color-pink-dark)',
            padding: '8px 12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--color-black)' }}>
            ✦ HOW TO USE MIXTAPE ✦
          </span>
          <button
            onClick={onClose}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              padding: '2px 8px',
              background: 'var(--color-pink-dark)',
              color: 'var(--color-white)',
              border: '2px solid var(--color-black)',
              boxShadow: '2px 2px 0px var(--color-black)',
              lineHeight: 1.4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Lang toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(['ko', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                padding: '4px 12px',
                background: lang === l ? 'var(--color-pink-dark)' : 'var(--color-blue)',
                color: lang === l ? 'var(--color-white)' : 'var(--color-black)',
                border: '2px solid var(--color-pink-dark)',
                boxShadow: lang === l ? 'none' : '2px 2px 0px var(--color-pink-dark)',
                transform: lang === l ? 'translate(2px,2px)' : undefined,
              }}
            >
              {l === 'ko' ? '한국어' : 'ENG'}
            </button>
          ))}
        </div>

        {/* Steps */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--color-pink-dark)', marginBottom: '12px', letterSpacing: '1px' }}>
            ░ BASIC FLOW ░
          </div>
          {STEPS[lang].map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '12px',
                padding: '12px',
                border: '2px solid var(--color-pink)',
                background: i % 2 === 0 ? 'rgba(255, 183, 213, 0.12)' : 'rgba(183, 223, 255, 0.12)',
              }}
            >
              <div style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1.4 }}>{step.icon}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '8px', color: 'var(--color-black)', marginBottom: '4px' }}>
                  {String(i + 1).padStart(2, '0')}. {step.title}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--color-black)', lineHeight: 1.4 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--color-blue-dark)', marginBottom: '12px', letterSpacing: '1px' }}>
            ░ TIPS ░
          </div>
          {TIPS[lang].map((tip, i) => (
            <div
              key={i}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '16px',
                color: 'var(--color-black)',
                lineHeight: 1.5,
                padding: '8px 12px',
                marginBottom: '6px',
                borderLeft: '4px solid var(--color-blue-dark)',
                background: 'rgba(183, 223, 255, 0.15)',
              }}
            >
              {tip}
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div
          style={{
            padding: '14px',
            border: '3px solid var(--color-pink-dark)',
            background: 'rgba(255, 105, 180, 0.08)',
            boxShadow: 'inset 2px 2px 0px var(--color-pink)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '8px', color: 'var(--color-pink-dark)', marginBottom: '8px' }}>
            COPYRIGHT NOTICE
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-black)', lineHeight: 1.5 }}>
            {COPYRIGHT[lang]}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-pink-dark)',
            marginTop: '20px',
            animation: 'blink 2s infinite',
          }}
        >
          ~ enjoy your mixtape ♡ ~
        </div>
      </div>
    </div>
  );
}
