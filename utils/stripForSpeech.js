/**
 * Strip HTML and markdown formatting for TTS (text-to-speech).
 * Returns clean, plain text suitable for SpeechSynthesis.
 */
export function stripForSpeech(text) {
  let clean = text;
  clean = clean.replace(/\*\*(.+?)\*\*/g, '$1');
  clean = clean.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
  clean = clean.replace(/`([^`]+)`/g, '$1');
  clean = clean.replace(/^#{1,3}\s+/gm, '');
  clean = clean.replace(/^[*-]\s+/gm, '');
  clean = clean.replace(/^\d+\.\s+/gm, '');
  // Remove emojis (basic range)
  clean = clean.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  clean = clean.replace(/\n{2,}/g, '. ');
  clean = clean.replace(/\n/g, '. ');
  clean = clean.trim();
  return clean;
}
