// ==========================================
// Geo Room Location Service
// CRUD operations for admin-managed room coordinates
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';

export interface GeoRoomLocation {
  id: string;
  room_name: string;
  latitude: number;
  longitude: number;
  plus_code: string | null;
  building_name: string | null;
  floor_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddGeoRoomInput {
  room_name: string;
  latitude: number;
  longitude: number;
  plus_code?: string;
  building_name?: string;
  floor_number?: string;
}

const ENDPOINT = '/geo-room-locations';

export async function getAllGeoRoomLocations(): Promise<GeoRoomLocation[]> {
  return apiClient.getList<GeoRoomLocation>(ENDPOINT);
}

export async function addGeoRoomLocation(input: AddGeoRoomInput): Promise<ServiceResult<GeoRoomLocation>> {
  return apiClient.post<GeoRoomLocation>(ENDPOINT, input);
}

export async function updateGeoRoomLocation(id: string, updates: Partial<AddGeoRoomInput> & { is_active?: boolean }): Promise<ServiceResult<GeoRoomLocation>> {
  return apiClient.patch<GeoRoomLocation>(ENDPOINT, { id, ...updates });
}

export async function deleteGeoRoomLocation(id: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { id });
}
