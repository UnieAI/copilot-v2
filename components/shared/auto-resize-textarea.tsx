"use client"

import React, { useState, useEffect, useRef, ChangeEvent,KeyboardEvent } from 'react'
import { Textarea } from '../ui/textarea';

interface AutoResizeTextareaProps {
  value: string;
  className?: string;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function AutoResizeTextarea({
  value,
  className,
  readOnly,
  disabled,
  placeholder,
  onChange,
  onKeyDown,
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState('auto');

  useEffect(() => {
    if (textareaRef.current) {
      // 5 lines * 24px
      const maxHeight = 120;
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
      // Set the height to the scrollHeight
      textareaRef.current.style.height = `${newHeight}px`;
      setTextareaHeight(`${newHeight}px`);
    }
  }, [value])

  return (
    <Textarea
      ref={textareaRef}
      className={`p-3 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md resize-none overflow-hidden overflow-y-auto ${className}`}
      value={value}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      style={{ height: textareaHeight, padding: '0.5rem' }}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  )
}