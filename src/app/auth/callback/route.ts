import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 邮件中的确认 / 重置密码链接会回到这里
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && next.startsWith('/reset-password')) {
      return NextResponse.redirect(new URL('/forgot?err=link_expired', url.origin));
    }
  } else if (url.searchParams.get('error') && next.startsWith('/reset-password')) {
    return NextResponse.redirect(new URL('/forgot?err=link_expired', url.origin));
  }
  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', url.origin));
}
