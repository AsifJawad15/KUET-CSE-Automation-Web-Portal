"use client";

import { useAuth } from '@/contexts/AuthContext';
import { askAssistant } from '@/services/assistantService';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, CalendarDays, MessageCircle, Minimize2, Send, Sparkles, X } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

const QUICK_PROMPTS = [
  'What is my today’s schedule?',
  'Show my next class',
  'Help me with attendance tasks',
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AdminTeacherChatbot() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const canUseAssistant = isAuthenticated && (user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'head');

  const initialMessage = useMemo<ChatMessage>(() => ({
    id: 'welcome',
    role: 'assistant',
    text: user?.role === 'admin'
      ? 'Ask me about schedules, admin work, or department operations.'
      : 'Ask me about your schedule, classes, attendance, or portal work.',
  }), [user?.role]);

  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);

  if (!canUseAssistant || !user?.id || !user.role) return null;

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const sendMessage = async (messageText: string) => {
    const cleanMessage = messageText.trim();
    if (!cleanMessage || isSending || !user.role) return;

    const userMessage: ChatMessage = { id: createId(), role: 'user', text: cleanMessage };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);
    scrollToBottom();

    const result = await askAssistant({
      message: cleanMessage,
      userId: user.id,
      userName: user.name,
      role: user.role,
    });

    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'assistant',
      text: result.success && result.data?.answer
        ? result.data.answer
        : result.error || 'I could not respond right now. Please try again.',
    };

    setMessages((current) => [...current, assistantMessage]);
    setIsSending(false);
    scrollToBottom();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="mb-4 w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/20 dark:border-[#3d4951]/60 dark:bg-[#121417]"
          >
            <div className="bg-[#1A0F08] px-4 py-4 text-[#FFF2E3]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#6E4229]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold">KUET CSE Assistant</h2>
                    <p className="text-xs font-medium text-[#D9C1A8]">Admin and teacher AI support</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="rounded-lg p-2 text-[#E6CCAE] transition hover:bg-white/10 hover:text-white"
                    title="Minimize assistant"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-2 text-[#E6CCAE] transition hover:bg-white/10 hover:text-white"
                    title="Close assistant"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div ref={listRef} className="max-h-[420px] space-y-3 overflow-y-auto bg-gray-50 px-4 py-4 dark:bg-[#0b090a]">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-[#6E4229] text-white'
                        : 'rounded-bl-md border border-gray-200 bg-white text-gray-800 shadow-sm dark:border-[#3d4951]/60 dark:bg-[#161a1d] dark:text-[#F8E9D7]'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-[#3d4951]/60 dark:bg-[#161a1d]">
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-[#b1a7a6]"
                        style={{ animationDelay: `${index * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white p-3 dark:border-[#3d4951]/60 dark:bg-[#121417]">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {QUICK_PROMPTS.map((prompt, index) => {
                  const Icon = index === 0 ? CalendarDays : Sparkles;
                  return (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-[#6E4229] hover:text-[#6E4229] dark:border-[#3d4951]/60 dark:text-[#D9C1A8]"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {prompt}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask me anything..."
                  className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition focus:border-[#6E4229] focus:bg-white dark:border-[#3d4951]/60 dark:bg-[#0b090a] dark:text-white"
                />
                <button
                  type="submit"
                  disabled={isSending || input.trim().length === 0}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#6E4229] text-white transition hover:bg-[#5B3521] disabled:cursor-not-allowed disabled:opacity-50"
                  title="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {(!isOpen || isMinimized) && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="group flex items-center gap-2"
        >
          <span className="hidden rounded-full bg-white px-4 py-2.5 text-sm font-bold text-gray-600 shadow-xl shadow-black/15 ring-1 ring-gray-100 transition group-hover:-translate-y-0.5 group-hover:text-[#6E4229] dark:bg-[#161a1d] dark:text-[#F8E9D7] dark:ring-[#3d4951]/60 sm:inline-flex">
            Ask me...
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6E4229] text-white shadow-xl shadow-[#6E4229]/35 ring-[3px] ring-white transition group-hover:-translate-y-0.5 group-hover:bg-[#5B3521] dark:ring-[#121417]">
            <MessageCircle className="h-5 w-5" />
          </span>
        </button>
      )}
    </div>
  );
}
