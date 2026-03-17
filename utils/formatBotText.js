/**
 * Simple markdown-like formatting for bot responses.
 * Converts markdown syntax to HTML for rendering in chat bubbles.
 */
export function formatBotText(raw) {
  let html = raw;

  // Paragraphs: double newlines
  html = html.replace(/\n{2,}/g, '</p><p>');

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (but not inside **)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers: ### / ## / #
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Unordered lists: lines starting with - or *
  html = html.replace(/(?:^|\n)((?:[*-] .+\n?)+)/g, function (_, list) {
    const items = list.trim().split('\n').map(function (line) {
      return '<li>' + line.replace(/^[*-]\s+/, '') + '</li>';
    }).join('');
    return '<ul>' + items + '</ul>';
  });

  // Ordered lists: lines starting with 1. 2. etc.
  html = html.replace(/(?:^|\n)((?:\d+\. .+\n?)+)/g, function (_, list) {
    const items = list.trim().split('\n').map(function (line) {
      return '<li>' + line.replace(/^\d+\.\s+/, '') + '</li>';
    }).join('');
    return '<ol>' + items + '</ol>';
  });

  // Single newlines → <br>
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  // Avoid paragraphs wrapping block elements
  html = html.replace(/<p>(<(?:ul|ol|h[1-3]))/g, '$1');
  html = html.replace(/(<\/(?:ul|ol|h[1-3])>)<\/p>/g, '$1');

  return html;
}
