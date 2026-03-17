'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import QuickActions from './QuickActions';
import TypingIndicator from './TypingIndicator';
import ListeningIndicator from './ListeningIndicator';
import ChatInput from './ChatInput';
import { formatBotText } from '@/utils/formatBotText';
import { stripForSpeech } from '@/utils/stripForSpeech';

// Generate a session ID
function generateSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function ChatBot() {
  // --- State ---
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [micState, setMicState] = useState('idle'); // 'idle' | 'recording' | 'processing'
  const [placeholder, setPlaceholder] = useState('Ask about groceries, recipes, diets…');

  // --- Refs ---
  const sessionIdRef = useRef(null);
  const isRecordingRef = useRef(false);
  const lastInputWasVoiceRef = useRef(false);
  const recognitionRef = useRef(null);
  const useFallbackRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const inputRef = useRef(null);
  const messageIdCounterRef = useRef(0);

  // Generate unique message IDs
  const nextMessageId = useCallback(() => {
    messageIdCounterRef.current += 1;
    return `msg-${messageIdCounterRef.current}`;
  }, []);

  // --- Initialize session ID and speech recognition ---
  useEffect(() => {
    sessionIdRef.current = generateSessionId();

    // Set up speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
    } else {
      useFallbackRef.current = true;
    }

    // Ensure voices are loaded
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {};
    }

    // Add welcome message
    setMessages([
      {
        id: 'welcome',
        content:
          '👋 <strong>Welcome!</strong> I\'m your Healthy Grocery Assistant.<br><br>' +
          'I can help you with:<br>' +
          '🥗 Personalized diet recommendations<br>' +
          '🛒 Grocery shopping lists<br>' +
          '📋 Meal planning ideas<br>' +
          '💪 Nutrition advice & BMI calculation<br><br>' +
          '🎤 <strong>Try voice chat!</strong> Click the mic button to speak your question.' +
          '<br>🔊 I\'ll read my responses aloud (toggle in header).',
        sender: 'bot',
        isHtml: true,
      },
    ]);
  }, []);

  // --- TTS ---
  const speakText = useCallback(
    (text) => {
      if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const clean = stripForSpeech(text);
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) => v.name.includes('Google US English') || v.name.includes('Google UK English')
      );
      const englishVoice = preferred || voices.find((v) => v.lang.startsWith('en'));
      if (englishVoice) utterance.voice = englishVoice;

      window.speechSynthesis.speak(utterance);
    },
    [ttsEnabled]
  );

  // --- Send Message & Stream Response ---
  const sendMessage = useCallback(
    async (messageText) => {
      const text = (messageText || '').trim();
      const shouldSpeak = lastInputWasVoiceRef.current;
      lastInputWasVoiceRef.current = false;
      if (!text || isGenerating) return;

      setIsGenerating(true);
      setShowQuickActions(false);

      // Add user message
      const userMsgId = nextMessageId();
      setMessages((prev) => [...prev, { id: userMsgId, content: text, sender: 'user', isHtml: false }]);

      // Show typing
      setIsTyping(true);

      // Add empty bot message (will be filled as tokens arrive)
      const botMsgId = nextMessageId();
      setMessages((prev) => [...prev, { id: botMsgId, content: '', sender: 'bot', isHtml: true }]);

      let fullText = '';
      let hasError = false;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, session_id: sessionIdRef.current }),
        });

        if (!response.ok) {
          let errorMsg = `Server error (${response.status})`;
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch (_) {}
          throw new Error(errorMsg);
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        setIsTyping(false);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6).trim();
              if (!payload) continue;
              try {
                const data = JSON.parse(payload);
                if (data.error) {
                  throw new Error(data.error);
                }
                if (data.content) {
                  fullText += data.content;
                  const formatted = formatBotText(fullText);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMsgId ? { ...msg, content: formatted } : msg
                    )
                  );
                }
                if (data.done) break;
              } catch (e) {
                if (e.message && !e.message.includes('JSON')) throw e;
              }
            }
          }
        }

        if (!fullText.trim()) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId
                ? { ...msg, content: '<em>No response received. Please try again.</em>', isError: true }
                : msg
            )
          );
        } else if (shouldSpeak) {
          speakText(fullText);
        }
      } catch (error) {
        hasError = true;
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId
              ? {
                  ...msg,
                  content: '⚠️ ' + (error.message || 'Something went wrong. Please try again.'),
                  isHtml: false,
                  isError: true,
                }
              : msg
          )
        );
      } finally {
        setIsGenerating(false);
        setIsTyping(false);
      }
    },
    [isGenerating, nextMessageId, speakText]
  );

  // --- Voice Input: Web Speech API ---
  const startSpeechRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || isRecordingRef.current) return;

    isRecordingRef.current = true;
    setMicState('recording');
    setIsListening(true);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setPlaceholder('Listening…');

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interim = '';
      finalTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          lastInputWasVoiceRef.current = true;
        } else {
          interim += transcript;
        }
      }
      if (inputRef.current) {
        inputRef.current.value = finalTranscript || interim;
      }
    };

    recognition.onend = () => {
      isRecordingRef.current = false;
      setMicState('idle');
      setIsListening(false);
      setPlaceholder('Ask about groceries, recipes, diets…');

      if (finalTranscript.trim()) {
        lastInputWasVoiceRef.current = true;
        sendMessage(finalTranscript.trim());
        finalTranscript = '';
      }
    };

    recognition.onerror = (event) => {
      isRecordingRef.current = false;
      setMicState('idle');
      setIsListening(false);
      setPlaceholder('Ask about groceries, recipes, diets…');
      finalTranscript = '';

      const errorMsgId = nextMessageId();
      let errorContent = '';

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        errorContent = '🎤 Microphone access denied. Please allow microphone permission in your browser settings and try again.';
      } else if (event.error === 'no-speech') {
        errorContent = '🎤 No speech detected. Please try again and speak clearly into your microphone.';
      } else if (event.error !== 'aborted') {
        errorContent = `🎤 Voice recognition error: ${event.error}. Please try again.`;
      }

      if (errorContent) {
        setMessages((prev) => [
          ...prev,
          { id: errorMsgId, content: errorContent, sender: 'bot', isHtml: true },
        ]);
      }
    };

    recognition.start();
  }, [sendMessage, nextMessageId]);

  const stopSpeechRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !isRecordingRef.current) return;
    recognition.stop();
  }, []);

  // --- Voice Input: MediaRecorder Fallback ---
  const startMediaRecorder = useCallback(async () => {
    if (isRecordingRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setMicState('processing');
        setIsListening(false);
        setPlaceholder('Transcribing…');

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();

          if (data.error) {
            const errId = nextMessageId();
            setMessages((prev) => [
              ...prev,
              { id: errId, content: `🎤 ${data.error}`, sender: 'bot', isHtml: true },
            ]);
          } else if (data.text) {
            lastInputWasVoiceRef.current = true;
            if (inputRef.current) inputRef.current.value = data.text;
            sendMessage(data.text);
          }
        } catch {
          const errId = nextMessageId();
          setMessages((prev) => [
            ...prev,
            { id: errId, content: '🎤 Failed to transcribe audio. Please try again.', sender: 'bot', isHtml: true },
          ]);
        } finally {
          setMicState('idle');
          setPlaceholder('Ask about groceries, recipes, diets…');
          isRecordingRef.current = false;
        }
      };

      recorder.start();
      isRecordingRef.current = true;
      setMicState('recording');
      setIsListening(true);
      setPlaceholder('Listening… (click 🎤 to stop)');
      mediaRecorderRef.current = recorder;
    } catch (err) {
      const errId = nextMessageId();
      let content = '';
      if (err.name === 'NotAllowedError') {
        content = '🎤 Microphone access denied. Please allow microphone permission and try again.';
      } else {
        content = `🎤 Could not access microphone: ${err.message}`;
      }
      setMessages((prev) => [
        ...prev,
        { id: errId, content, sender: 'bot', isHtml: true },
      ]);
    }
  }, [sendMessage, nextMessageId]);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // --- Mic Toggle ---
  const handleMicToggle = useCallback(() => {
    if (isGenerating) return;

    if (isRecordingRef.current) {
      if (useFallbackRef.current) {
        stopMediaRecorder();
      } else {
        stopSpeechRecognition();
      }
    } else {
      if (useFallbackRef.current) {
        startMediaRecorder();
      } else {
        startSpeechRecognition();
      }
    }
  }, [isGenerating, stopMediaRecorder, stopSpeechRecognition, startMediaRecorder, startSpeechRecognition]);

  // --- TTS Toggle ---
  const handleToggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      if (prev && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return !prev;
    });
  }, []);

  // --- Handle send ---
  const handleSend = useCallback(
    (text) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  // --- Build messages with error class ---
  const displayMessages = messages.map((msg) => ({
    ...msg,
    content: msg.isError
      ? `<div class="error-message message bot-message" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;animation:none;opacity:1">${msg.content}</div>`
      : msg.content,
    // If there was an error and isHtml is false, make it html for the wrapper
    isHtml: msg.isError ? true : msg.isHtml,
  }));

  return (
    <div className="chatbot-container">
      <ChatHeader ttsEnabled={ttsEnabled} onToggleTts={handleToggleTts} />
      <MessageList messages={messages} />
      <QuickActions visible={showQuickActions} onChipClick={handleSend} />
      <TypingIndicator visible={isTyping} />
      <ListeningIndicator visible={isListening} />
      <ChatInput
        disabled={isGenerating}
        isRecording={micState}
        onSend={handleSend}
        onMicToggle={handleMicToggle}
        inputRef={inputRef}
        placeholder={placeholder}
      />
    </div>
  );
}
