'use client';

import { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';

export default function MessageList({ messages }) {
  const containerRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="chatbot-messages"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          content={msg.content}
          sender={msg.sender}
          isHtml={msg.isHtml}
        />
      ))}
    </div>
  );
}
