import { apiClient, ServiceResult } from '@/lib/httpClient';
import type { StaffWithAuth } from '@/types/database';

export interface AddStaffInput {
  full_name: string;
  email: string;
  phone?: string;
  designation: string;
  is_admin: boolean;
  permissions?: {
    all: boolean;
    menus: string[];
    source?: string;
  };
  password?: string;
}

export interface AddStaffResponse extends ServiceResult<StaffWithAuth> {
  generatedPassword?: string;
}

export interface StaffPermissionInput {
  all: boolean;
  menus: string[];
}

const ENDPOINT = '/staffs';

export async function getAllStaffs(): Promise<StaffWithAuth[]> {
  return apiClient.getList<StaffWithAuth>(ENDPOINT);
}

export async function addStaff(input: AddStaffInput): Promise<AddStaffResponse> {
  const result = await apiClient.post<StaffWithAuth & { generatedPassword?: string }>(ENDPOINT, input);
  return {
    ...result,
    generatedPassword: result.data?.generatedPassword,
  };
}

export async function setStaffAdmin(
  userId: string,
  isAdmin: boolean,
): Promise<ServiceResult<void>> {
  return apiClient.patch(ENDPOINT, {
    userId,
    action: 'set_admin',
    is_admin: isAdmin,
  });
}

export async function deactivateStaff(userId: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { userId });
}

export async function removeStaffFully(userId: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { userId, mode: 'hard' });
}

export async function setStaffPermissions(
  userId: string,
  permissions: StaffPermissionInput,
): Promise<ServiceResult<void>> {
  return apiClient.patch(ENDPOINT, {
    userId,
    action: 'set_permissions',
    permissions,
  });
}
