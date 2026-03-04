"use client";
import { useEffect, useMemo, useRef } from "react";
import { motion, stagger, useAnimate } from "motion/react";
import { cn } from "@/lib/utils";

function longestCommonPrefixLength(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

const SENTENCE_DELIM_RE = /[。！？!?；;，,：:、\n]/;

function splitCompletedSentences(input: string) {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const completed: string[] = [];
  let buffer = "";

  for (const ch of Array.from(normalized)) {
    buffer += ch;
    // Newline is always a hard boundary, independent of punctuation.
    if (ch === "\n" || SENTENCE_DELIM_RE.test(ch)) {
      completed.push(buffer);
      buffer = "";
    }
  }

  return {
    completed,
    tail: buffer,
  };
}

export const TextGenerateEffect = ({
  words,
  className,
  wordClassName,
  filter = true,
  duration = 0.18,
}: {
  words: string;
  className?: string;
  wordClassName?: string;
  filter?: boolean;
  duration?: number;
}) => {
  const [scope, animate] = useAnimate();
  const prevCompletedRef = useRef("");

  const { stablePrefix, deltaSentences, pendingTail, nextCompletedText } = useMemo(() => {
    const prevCompleted = prevCompletedRef.current || "";
    const { completed, tail } = splitCompletedSentences(words);
    const completedText = completed.join("");
    const commonLen = longestCommonPrefixLength(prevCompleted, completedText);
    const prefix = completedText.slice(0, commonLen);
    const delta = completedText.slice(commonLen);
    return {
      stablePrefix: prefix,
      deltaSentences: delta ? splitCompletedSentences(delta).completed : [],
      pendingTail: tail,
      nextCompletedText: completedText,
    };
  }, [words]);

  useEffect(() => {
    prevCompletedRef.current = nextCompletedText;
    animate(
      "[data-animate='1']",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration: duration ? duration : 1,
        delay: stagger(0.06),
      }
    );
  }, [animate, filter, duration, words, nextCompletedText]);

  const renderContent = () => {
    return (
      <motion.div ref={scope}>
        {stablePrefix ? (
          <span className={cn(wordClassName)}>
            {stablePrefix}
          </span>
        ) : null}
        {deltaSentences.map((sentence, idx) => (
          <motion.span
            key={`${idx}-${sentence.length}-${sentence.slice(0, 16)}`}
            data-animate="1"
            className={cn("opacity-0", wordClassName)}
            style={{
              filter: filter ? "blur(10px)" : "none",
            }}
          >
            {sentence}
          </motion.span>
        ))}
        {pendingTail ? (
          <span className={cn(wordClassName)}>
            {pendingTail}
          </span>
        ) : null}
      </motion.div>
    );
  };

  return (
    <div className={cn(className)}>{renderContent()}</div>
  );
};
