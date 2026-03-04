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

/**
 * Split text into chunks at every \n boundary.
 * Both \n and \n\n are respected — each \n ends the current chunk
 * (the \n is included at the end of the chunk so layout is preserved).
 */
function splitAtNewlines(input: string) {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const completed: string[] = [];
  let buffer = "";

  for (const ch of Array.from(normalized)) {
    buffer += ch;
    if (ch === "\n") {
      completed.push(buffer);
      buffer = "";
    }
  }

  return { completed, tail: buffer };
}


export const TextGenerateEffect = ({
  words,
  className,
  wordClassName,
  filter = true,
  duration = 0.18,
  initialText,
}: {
  words: string;
  className?: string;
  wordClassName?: string;
  filter?: boolean;
  duration?: number;
  /** Text already present when this component mounted — skip animation for it. */
  initialText?: string;
}) => {
  const [scope, animate] = useAnimate();
  // Pre-seed with initialText so existing text is never animated on mount.
  const prevCompletedRef = useRef(
    initialText ? splitAtNewlines(initialText).completed.join("") : ""
  );

  const { stablePrefix, deltaSentences, pendingTail, nextCompletedText } = useMemo(() => {
    const prevCompleted = prevCompletedRef.current || "";
    const { completed, tail } = splitAtNewlines(words);
    const completedText = completed.join("");
    const commonLen = longestCommonPrefixLength(prevCompleted, completedText);
    const prefix = completedText.slice(0, commonLen);
    const delta = completedText.slice(commonLen);
    return {
      stablePrefix: prefix,
      deltaSentences: delta ? splitAtNewlines(delta).completed : [],
      pendingTail: tail,
      nextCompletedText: completedText,
    };
  }, [words]);

  useEffect(() => {
    prevCompletedRef.current = nextCompletedText;
    if (scope.current && scope.current.querySelector("[data-animate='1']")) {
      try {
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
      } catch (err) {
        console.warn("Framer motion animation error:", err);
      }
    }
  }, [animate, filter, duration, scope, nextCompletedText]);

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
