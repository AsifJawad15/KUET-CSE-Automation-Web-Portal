import type { User } from '@/contexts/AuthContext';

export interface AdminModulePermissions {
  all?: boolean;
  menus?: string[];
  source?: string;
}

export interface AdminPermissionPayload {
  all: boolean;
  menus: string[];
  source: string;
}

const ALWAYS_ALLOWED_MENUS = new Set(['dashboard', 'settings']);

function normalizeMenus(menus: unknown): string[] {
  if (!Array.isArray(menus)) return [];
  return menus
    .filter((menu): menu is string => typeof menu === 'string' && menu.trim().length > 0)
    .map((menu) => menu.trim());
}

export function normalizeAdminPermissions(raw: unknown): AdminModulePermissions | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as { all?: unknown; menus?: unknown; source?: unknown };
  return {
    all: candidate.all === true,
    menus: normalizeMenus(candidate.menus),
    source: typeof candidate.source === 'string' ? candidate.source : undefined,
  };
}

export function canAccessMenu(user: User | null, menuId: string): boolean {
  if (!user) return false;
  if (ALWAYS_ALLOWED_MENUS.has(menuId)) return true;
  if (user.role !== 'admin') return true;

  const permissions = normalizeAdminPermissions(user.permissions);
  if (!permissions) return true;
  if (permissions.all) return true;

  const allowedMenus = new Set(permissions.menus ?? []);
  return allowedMenus.has(menuId);
}

export function createPermissionPayload(all: boolean, menus: string[]): AdminPermissionPayload {
  return {
    all,
    menus: all ? [] : normalizeMenus(menus),
    source: 'staff_management_custom',
  };
}
