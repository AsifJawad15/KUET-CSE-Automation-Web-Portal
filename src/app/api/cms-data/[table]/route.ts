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
  const configuredCmsSecrets = Object.entries(process.env)
    .filter(([name, value]) => Boolean(value) && (
      name === 'CMS_SUPABASE_SECRET_KEY' || name.startsWith('CMS_SUPABASE_SECRET_KEY_')
    ))
    .sort(([left], [right]) => {
      if (left === 'CMS_SUPABASE_SECRET_KEY') return -1;
      if (right === 'CMS_SUPABASE_SECRET_KEY') return 1;
      return left.localeCompare(right);
    })
    .map(([, value]) => value as string);
  const serviceKeys = Array.from(new Set([
    ...configuredCmsSecrets,
    process.env.CMS_SUPABASE_SERVICE_ROLE_KEY,
    url === process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined,
  ].filter((value): value is string => Boolean(value))));
  const publicKey = process.env.NEXT_PUBLIC_CMS_SUPABASE_ANON_KEY ||
    (url === process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);
  const isRead = ['GET', 'HEAD'].includes(request.method);
  if (!url || (serviceKeys.length === 0 && (!isRead || !publicKey))) {
    return NextResponse.json(
      {
        error: isRead
          ? 'CMS credentials are not configured'
          : 'CMS_SUPABASE_SECRET_KEY is required for CMS changes',
      },
      { status: 503 },
    );
  }
  try {
    const body = ['GET','HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 1_048_576) return NextResponse.json({ error: 'Request too large' }, { status: 413 });

    const send = (requestKey: string) => {
      const headers = new Headers({ apikey: requestKey });
      // Legacy service-role keys are JWTs and can also act as the bearer token.
      // New sb_secret keys authenticate through the apikey header only.
      if (requestKey.startsWith('eyJ')) headers.set('authorization', `Bearer ${requestKey}`);
      for (const name of ['content-type','prefer','accept','range']) {
        const value = request.headers.get(name); if (value) headers.set(name,value);
      }
      return fetch(`${url}/rest/v1/${table}${request.nextUrl.search}`, {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
    };

    let accessMode = 'service';
    let result: Response | undefined;
    for (const serviceKey of serviceKeys) {
      result = await send(serviceKey);
      if (result.status !== 401) break;
    }
    if ((!result || result.status === 401) && isRead && publicKey) {
      // Invalid or rotating server keys must not hide deliberately public CMS
      // content. Private resources still fail closed under their RLS policy.
      result = await send(publicKey);
      accessMode = 'public-read-fallback';
    }
    if (!result) return NextResponse.json({ error: 'CMS server credentials are not configured' }, { status: 503 });

    const responseHeaders = new Headers({
      'Cache-Control':'no-store',
      'X-CMS-Access-Mode': accessMode,
    });
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
