import { DBRoom, DBRoomType } from '@/lib/supabase';

export interface AddRoomInput {
  room_number: string;
  building_name?: string;
  capacity?: number;
  room_type?: DBRoomType;
  facilities?: string[];
}

export interface RoomResponse {
  success: boolean;
  data?: DBRoom;
  error?: string;
}

export async function getAllRooms(): Promise<DBRoom[]> {
  try {
    const response = await fetch('/api/rooms');
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}

export async function addRoom(input: AddRoomInput): Promise<RoomResponse> {
  try {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to add room' };
  }
}

export async function updateRoom(room_number: string, updates: Partial<AddRoomInput>): Promise<RoomResponse> {
  try {
    const response = await fetch('/api/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_number, ...updates }),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update room' };
  }
}

export async function deleteRoom(room_number: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/rooms?room_number=${encodeURIComponent(room_number)}`, {
      method: 'DELETE',
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete room' };
  }
}
