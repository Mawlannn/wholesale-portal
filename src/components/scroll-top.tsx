'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** 每次进入新页面（包括操作后跳回、切换标签）都从页面顶部开始显示 */
export function ScrollTop() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search]);
  return null;
}
