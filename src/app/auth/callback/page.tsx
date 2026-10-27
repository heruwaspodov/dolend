import { ReturnMessage } from '@/components/layout/return-message';
import { PageShell } from '@/components/layout/page-shell';
export default function AuthCallbackPage() {
  return <PageShell><ReturnMessage kind="auth" /></PageShell>;
}
