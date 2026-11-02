'use client';

import { useEffect, useRef } from 'react';
import { acceptEmailTokens } from '@/lib/actions/auth';

// 重置密码等邮件链接会带着 #access_token=... 回到这里（浏览器才看得到 # 后面的内容）
export default function ConfirmPage() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const next = query.get('next') || '/';
    const access = hash.get('access_token');
    const refresh = hash.get('refresh_token');
    if (access && refresh) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      acceptEmailTokens(access, refresh, next);
    } else {
      window.location.replace('/forgot?err=link_expired');
    }
  }, []);
  return (
    <main className="grid min-h-dvh place-items-center text-sm text-gray-500">
      <span className="animate-pulse">…</span>
    </main>
  );
}
