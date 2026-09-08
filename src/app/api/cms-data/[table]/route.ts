import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
const tables = new Set(['cms_hero_slides','cms_department_info','cms_hod_message','cms_stats','cms_news_events',
  'cms_research_highlights','cms_lab_facilities','cms_clubs_activities','cms_gallery','cms_navigation_links',
  'cms_page_sections','cms_programs','cms_faculty','cms_tv_announcements','cms_tv_ticker','cms_tv_settings',
  'cms_tv_events','cms_tv_devices']);
async function handle(request: NextRequest, context: { params: Promise<{ table: string }> }) {
  const auth = await requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const { table } = await context.params;
  if (!tables.has(table)) return NextResponse.json({ error: 'Unknown CMS resource' }, { status: 404 });
  const url = process.env.NEXT_PUBLIC_CMS_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CMS_SUPABASE_SERVICE_ROLE_KEY ||
    (url === process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
  if (!url || !key) return NextResponse.json({ error: 'CMS server credentials are not configured' }, { status: 503 });
  try {
    const headers = new Headers({ apikey: key, authorization: `Bearer ${key}` });
    for (const name of ['content-type','prefer','accept','range']) {
      const value = request.headers.get(name); if (value) headers.set(name,value);
    }
    const body = ['GET','HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 1_048_576) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    const result = await fetch(`${url}/rest/v1/${table}${request.nextUrl.search}`, { method: request.method, headers,
      body, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(15000) });
    const responseHeaders = new Headers({ 'Cache-Control':'no-store' });
    for (const name of ['content-type','content-range']) {
      const value=result.headers.get(name); if (value) responseHeaders.set(name,value);
    }
    return new NextResponse(result.body,{status:result.status,headers:responseHeaders});
  } catch { return NextResponse.json({error:'CMS service unavailable'},{status:503}); }
}
export const GET=handle;
export const HEAD=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
