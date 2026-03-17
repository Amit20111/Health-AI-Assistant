'use client';

export default function TypingIndicator({ visible }) {
  return (
    <div className={`typing-indicator${visible ? ' visible' : ''}`} aria-label="Assistant is typing">
      <span className="typing-dot"></span>
      <span className="typing-dot"></span>
      <span className="typing-dot"></span>
    </div>
  );
}
