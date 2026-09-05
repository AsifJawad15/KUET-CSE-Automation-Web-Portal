/** Modules use the same identifiers as Staff Management and dashboard menus. */
export function adminRouteAllowed(path: string, method: string, menus: string[]): boolean {
  if (path.startsWith('/api/auth/') && !path.startsWith('/api/auth/recovery')) return true;
  if (path.startsWith('/api/data/') && ['GET', 'HEAD'].includes(method)) return true;
  if (path === '/api/notifications' && ['GET', 'PATCH'].includes(method)) return true;
  const resource = path.split('/')[2];
  const routeMenus: Record<string, string[]> = {
    teachers: method === 'GET' ? ['faculty-info', 'add-faculty'] : ['add-faculty'],
    students: path.includes('/cr') ? ['cr-management'] : ['add-student'],
    staffs: ['staff-management'], courses: ['course-info'], 'course-offerings': ['course-allocation'],
    rooms: ['room-info'], 'geo-room-locations': ['room-info'],
    'routine-generator': ['class-routine'], 'routine-slots': ['class-routine'], upload: ['class-routine'],
    'optional-course-assignments': ['optional-courses'], 'term-upgrades': ['term-upgrade'],
    'cr-room-requests': ['schedule'], schedule: ['schedule'], 'cms-data': ['website-cms'],
    'tv-display': ['tv-display'],
  };
  return (routeMenus[resource] ?? []).some(menu => menus.includes(menu));
}
