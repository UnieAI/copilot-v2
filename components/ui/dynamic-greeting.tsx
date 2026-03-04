'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Generate stable random indices on module load (persists until page refresh)
const greetingTypeRandom = Math.random(); // 0-1, determines time-based vs random
const greetingIndexRandom = Math.random(); // 0-1, determines which greeting in array

interface DynamicGreetingProps {
    className?: string;
}

/**
 * Dynamic greeting with letter-by-letter hover effect.
 * Uses stable random indices so greeting type stays consistent,
 * but text updates immediately when language changes.
 * 
 * Returns null during SSR to avoid flash of placeholder text.
 * The parent's fade-in animation makes this seamless.
 */
export function DynamicGreeting({ className }: DynamicGreetingProps) {
    const t = useTranslations('Home');
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Compute greeting - recalculates when t changes (i.e., when language changes)
    const greeting = useMemo(() => {
        // Only compute after mount to avoid hydration mismatch
        if (!mounted) return '';

        const hour = new Date().getHours();
        const pickRandom = (values: unknown, fallback: string[]) => {
            const list = Array.isArray(values)
                ? values.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
                : fallback;
            if (list.length === 0) return '';
            return list[Math.floor(greetingIndexRandom * list.length)];
        };

        // 40% chance time-based, 60% random
        const useTimeBased = greetingTypeRandom < 0.4;

        if (useTimeBased) {
            if (hour >= 5 && hour < 12) {
                return pickRandom(t.raw('greetings.morning'), []);
            } else if (hour >= 12 && hour < 17) {
                return pickRandom(t.raw('greetings.afternoon'), []);
            } else {
                return pickRandom(t.raw('greetings.evening'), []);
            }
        }

        return pickRandom(t.raw('greetings.random'), []);
    }, [t, mounted]);

    // Calculate lift amount based on distance from hovered letter
    const getLiftAmount = (index: number): number => {
        if (hoveredIndex === null) return 0;
        const distance = Math.abs(index - hoveredIndex);
        if (distance === 0) return -6;
        if (distance === 1) return -5;
        if (distance === 2) return -4;
        if (distance === 3) return -3;
        if (distance === 4) return -2;
        if (distance === 5) return -1.5;
        if (distance === 6) return -0.5;
        return 0;
    };

    // Return empty container during SSR to avoid flash of different text.
    // The parent's fade-in animation makes this seamless.
    if (!mounted) {
        return <span className={cn('tracking-tight opacity-0', className)}>&nbsp;</span>;
    }

    // Split by whitespace but keep whitespace tokens so the browser can wrap between words.
    // We render each word as a single inline group to prevent mid-word line breaks (e.g. "W" + "hat's").
    const tokens = greeting.split(/(\s+)/);
    let globalLetterIndex = 0;

    return (
        <span className={cn('tracking-tight', className)}>
            {/* Accessibility: announce the full greeting as a sentence, not letter-by-letter */}
            <span className="sr-only">{greeting}</span>
            <span aria-hidden="true">
                {tokens.map((token, tokenIndex) => {
                    // Preserve whitespace as-is so wrapping occurs only at spaces.
                    if (/^\s+$/.test(token)) {
                        return <span key={`space-${tokenIndex}`}>{token}</span>;
                    }

                    return (
                        <span key={`word-${tokenIndex}`} className="inline-flex whitespace-nowrap">
                            {Array.from(token).map((letter) => {
                                const index = globalLetterIndex++;
                                return (
                                    <span
                                        key={index}
                                        onMouseEnter={() => setHoveredIndex(index)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                        className="inline-block cursor-default transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                                        style={{ transform: `translateY(${getLiftAmount(index)}px)` }}
                                    >
                                        {letter}
                                    </span>
                                );
                            })}
                        </span>
                    );
                })}
            </span>
        </span>
    );
}
