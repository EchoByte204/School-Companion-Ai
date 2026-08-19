import { useEffect, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";

type SyncedMessageResponseProps = {
  text: string;
  isSpeaking: boolean;
  isLatest: boolean;
};

export function SyncedMessageResponse({ text, isSpeaking, isLatest }: SyncedMessageResponseProps) {
  const [displayedText, setDisplayedText] = useState(text);

  useEffect(() => {
    // If it's not the latest message or not currently speaking, show full text immediately
    if (!isLatest || !isSpeaking || !text.trim()) {
      setDisplayedText(text);
      return;
    }

    const words = text.split(/(\s+)/);
    if (words.length <= 1) {
      setDisplayedText(text);
      return;
    }

    let currentIndex = 0;
    setDisplayedText("");

    // Average reading speed: ~220ms per word chunk for natural speech sync
    const intervalMs = Math.max(
      120,
      Math.min(280, Math.floor(3500 / Math.max(10, words.length / 2))),
    );

    const timer = setInterval(() => {
      currentIndex += 2; // advance word + whitespace
      if (currentIndex >= words.length) {
        setDisplayedText(text);
        clearInterval(timer);
      } else {
        setDisplayedText(words.slice(0, currentIndex).join(""));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [text, isSpeaking, isLatest]);

  return <MessageResponse>{displayedText}</MessageResponse>;
}
