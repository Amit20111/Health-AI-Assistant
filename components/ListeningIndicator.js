'use client';

export default function ListeningIndicator({ visible }) {
  return (
    <div
      className={`listening-indicator${visible ? ' visible' : ''}`}
      aria-label="Listening for speech"
    >
      <div className="listening-pulse-ring"></div>
      <div className="listening-pulse-ring delay-1"></div>
      <div className="listening-pulse-ring delay-2"></div>
      <svg className="listening-mic-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      </svg>
      <span className="listening-text">Listening…</span>
    </div>
  );
}
