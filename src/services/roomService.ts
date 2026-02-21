// ==========================================
// Room Service
// Dependency Inversion: Uses httpClient abstraction, not raw fetch
// Single Responsibility: Only handles room-related API calls
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';
import type { DBRoom, DBRoomType } from '@/types/database';

// ── Input / Response Types ─────────────────────────────

export interface AddRoomInput {
  room_number: string;
  building_name?: string;
  capacity?: number;
  room_type?: DBRoomType;
  facilities?: string[];
}

export type RoomResponse = ServiceResult<DBRoom>;

// ── API Methods ────────────────────────────────────────

const ENDPOINT = '/rooms';

export async function getAllRooms(): Promise<DBRoom[]> {
  return apiClient.getList<DBRoom>(ENDPOINT);
}

export async function addRoom(input: AddRoomInput): Promise<RoomResponse> {
  return apiClient.post<DBRoom>(ENDPOINT, input);
}

export async function updateRoom(room_number: string, updates: Partial<AddRoomInput>): Promise<RoomResponse> {
  return apiClient.patch<DBRoom>(ENDPOINT, { room_number, ...updates });
}

export async function deleteRoom(room_number: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { room_number });
}
