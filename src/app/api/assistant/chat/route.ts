import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { isSupabaseConfigured } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { detectAdminCommand, executeAdminCommand } from './adminCommands';
import { answerSystemInfoSearch, detectSystemInfoSearch } from './systemInfoSearch';
import { answerTeacherDataIntent, detectTeacherDataIntent } from './teacherAssistantData';

type ChatRole = 'admin' | 'teacher' | 'head';
type AiProvider = 'gemini' | 'openai';

type ChatRequest = {
  message?: string;
  userId?: string;
  userName?: string;
  role?: ChatRole;
};

const ASSISTANT_SYSTEM_INSTRUCTION = [
  'You are the KUET CSE Automation assistant for admins and teachers only.',
  'The user communicates in English. Handle normal English, short phrases, and minor typos.',
  'Always answer in a clean structured format with short headings and line breaks.',
  'Be concise, professional, and action-oriented.',
  'Do not invent private database facts. If system data is required, say what information is needed.',
].join(' ');

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getAiProvider(): AiProvider {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  return provider === 'openai' ? 'openai' : 'gemini';
}

function buildUserPrompt(input: ChatRequest): string {
  return `User: ${input.userName ?? 'User'} (${input.role ?? 'unknown'}). Question: ${input.message}`;
}

function getGeminiSettings() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return { apiKey, model };
}

async function generateGeminiText({
  systemInstruction,
  prompt,
  responseMimeType = 'text/plain',
  temperature = 0.2,
}: {
  systemInstruction: string;
  prompt: string;
  responseMimeType?: 'text/plain' | 'application/json';
  temperature?: number;
}): Promise<string | null> {
  const { apiKey, model } = getGeminiSettings();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          responseMimeType,
        },
      }),
    },
  );

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error?.message || `Gemini request failed with status ${response.status}`);
  }

  const text = json.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim();

  return text || null;
}

async function askGemini(input: ChatRequest): Promise<string> {
  const text = await generateGeminiText({
    systemInstruction: ASSISTANT_SYSTEM_INSTRUCTION,
    prompt: buildUserPrompt(input),
  });

  if (!text) {
    return [
      'The Gemini API key is not configured yet.',
      'I can already answer teacher schedule questions from the system data. For other questions, add GEMINI_API_KEY to the web environment.',
    ].join('\n');
  }

  return text;
}

async function askOpenAI(input: ChatRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return [
      'The AI key is not configured yet.',
      'I can already answer teacher schedule questions from the system data. For other questions, add OPENAI_API_KEY to the web environment.',
    ].join('\n');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: ASSISTANT_SYSTEM_INSTRUCTION,
        },
        {
          role: 'user',
          content: buildUserPrompt(input),
        },
      ],
    }),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error?.message || `AI request failed with status ${response.status}`);
  }

  return json.choices?.[0]?.message?.content?.trim() || 'I could not generate a response right now.';
}

async function askConfiguredModel(input: ChatRequest): Promise<string> {
  return getAiProvider() === 'openai' ? askOpenAI(input) : askGemini(input);
}

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = (await request.json()) as ChatRequest;
    const message = body.message?.trim() ?? '';
    const role = body.role;

    if (!message) return badRequest('Message is required');
    if (!role || !['admin', 'teacher', 'head'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Assistant access is limited to admin and teacher accounts.' }, { status: 403 });
    }

    const adminCommand = detectAdminCommand(message);
    if (adminCommand) {
      const answer = await executeAdminCommand(adminCommand, body.userName ?? 'Assistant User');
      return NextResponse.json({ success: true, data: { answer, source: 'tv-command' } });
    }

    const infoSearch = detectSystemInfoSearch(message);
    if (infoSearch) {
      const answer = await answerSystemInfoSearch(infoSearch);
      return NextResponse.json({ success: true, data: { answer, source: 'system-info' } });
    }

    const teacherDataIntent = detectTeacherDataIntent(message);
    if (teacherDataIntent) {
      if ((role === 'teacher' || role === 'head') && body.userId) {
        const answer = await answerTeacherDataIntent(teacherDataIntent, body.userId);
        return NextResponse.json({ success: true, data: { answer, source: teacherDataIntent } });
      }

      return NextResponse.json({
        success: true,
        data: {
          answer: 'Please specify a teacher account to view individual course or schedule information.',
          source: teacherDataIntent,
        },
      });
    }

    const answer = await askConfiguredModel(body);
    return NextResponse.json({ success: true, data: { answer, source: 'ai' } });
  } catch (error: unknown) {
    const message = extractError(error, 'Assistant failed to respond');
    console.error('[Assistant Chat]', message);
    return internalError(message);
  }
}
