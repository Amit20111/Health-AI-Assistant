'use client';

import { useRef, useEffect, useCallback } from 'react';

export default function ChatInput({
  disabled,
  isRecording,
  onSend,
  onMicToggle,
  inputRef: externalInputRef,
  placeholder,
}) {
  const internalRef = useRef(null);
  const textareaRef = externalInputRef || internalRef;

  // Auto-resize textarea on input
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [textareaRef]);

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const value = textareaRef.current?.value || '';
        if (value.trim()) {
          onSend(value);
          if (textareaRef.current) {
            textareaRef.current.value = '';
            textareaRef.current.style.height = 'auto';
          }
        }
      }
    },
    [onSend, textareaRef]
  );

  // Handle send button click
  const handleSendClick = useCallback(() => {
    const value = textareaRef.current?.value || '';
    if (value.trim()) {
      onSend(value);
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [onSend, textareaRef]);

  // Focus when enabled
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled, textareaRef]);

  // Determine mic button classes
  let micClassName = 'mic-button';
  if (isRecording === 'recording') micClassName += ' recording';
  else if (isRecording === 'processing') micClassName += ' processing';

  return (
    <div className="chatbot-input">
      <textarea
        ref={textareaRef}
        placeholder={placeholder || 'Ask about groceries, recipes, diets…'}
        rows={1}
        aria-label="Type your message"
        disabled={disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
      <button
        className={micClassName}
        type="button"
        aria-label="Voice input"
        title="Hold or click to speak"
        disabled={disabled}
        onClick={onMicToggle}
      >
        {isRecording === 'recording' ? (
          <svg className="mic-icon-recording" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="mic-icon-default" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
      <button
        className="send-button"
        type="button"
        aria-label="Send message"
        disabled={disabled}
        onClick={handleSendClick}
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}
