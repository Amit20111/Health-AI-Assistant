'use client';

export default function MessageBubble({ content, sender, isHtml }) {
  const className = `message ${sender}-message`;

  if (isHtml) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return <div className={className}>{content}</div>;
}
