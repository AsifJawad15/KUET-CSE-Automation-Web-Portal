import { apiClient, ServiceResult } from '@/lib/httpClient';
import type { UserRole } from '@/contexts/AuthContext';

export interface AssistantChatInput {
  message: string;
  userId: string;
  userName: string;
  role: Exclude<UserRole, null>;
}

export interface AssistantChatResponse {
  answer: string;
  source: 'schedule' | 'ai';
}

export async function askAssistant(input: AssistantChatInput): Promise<ServiceResult<AssistantChatResponse>> {
  return apiClient.post<AssistantChatResponse>('/assistant/chat', input);
}
