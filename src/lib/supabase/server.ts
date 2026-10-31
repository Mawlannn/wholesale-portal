import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** 以当前登录用户身份访问数据库（受权限控制） */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 在 Server Component 里无法写 cookie，由 middleware 负责刷新
        }
      },
    },
  });
}
