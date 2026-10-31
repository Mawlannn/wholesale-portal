import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** 服务端专用（绕过权限），只用于发邮件记录、通知等系统操作，绝不能给浏览器 */
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
