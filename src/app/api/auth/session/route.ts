import { NextRequest } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { ok } from '@/lib/apiResponse';
export async function POST(request: NextRequest) {
  const auth = await requireServerSession(request);
  if (auth.response) return auth.response;
  return ok(auth.user);
}
