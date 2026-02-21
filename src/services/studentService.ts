// ==========================================
// Student Service
// Dependency Inversion: Uses httpClient abstraction, not raw fetch
// Single Responsibility: Only handles student-related API calls
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';
import type { StudentWithAuth } from '@/types/database';

// Re-export for backward compatibility
export type { StudentWithAuth };

// ── Input / Response Types ─────────────────────────────

export interface AddStudentInput {
  full_name: string;
  email: string;
  phone: string;
  roll_no: string;
  term: string;   // Format: '1-1' .. '4-2'
  session: string; // e.g., '2024'
}

export interface AddStudentResponse extends ServiceResult<StudentWithAuth> {
  initialPassword?: string;
}

// ── Pure Helpers (no side effects) ─────────────────────

export function formatTerm(year: number, termNumber: number): string {
  return `${year}-${termNumber}`;
}

export function formatSession(batch: string): string {
  return `20${batch}`;
}

// ── API Methods ────────────────────────────────────────

const ENDPOINT = '/students';

/** Create a new student (profile + student record). */
export async function addStudent(input: AddStudentInput): Promise<AddStudentResponse> {
  return apiClient.post<StudentWithAuth>(ENDPOINT, input) as Promise<AddStudentResponse>;
}

/** Fetch all students with their auth info. */
export async function getAllStudents(): Promise<StudentWithAuth[]> {
  return apiClient.getList<StudentWithAuth>(ENDPOINT);
}

/** Soft-delete (deactivate) a student. */
export async function deleteStudent(userId: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { userId });
}

/** Search students by name, roll, or session. */
export async function searchStudents(query: string): Promise<StudentWithAuth[]> {
  return apiClient.getList<StudentWithAuth>(ENDPOINT, { q: query });
}

/** Get students filtered by session (batch year). */
export async function getStudentsBySession(session: string): Promise<StudentWithAuth[]> {
  return apiClient.getList<StudentWithAuth>(ENDPOINT, { session });
}

/** Get students filtered by term. */
export async function getStudentsByTerm(term: string): Promise<StudentWithAuth[]> {
  return apiClient.getList<StudentWithAuth>(ENDPOINT, { term });
}
