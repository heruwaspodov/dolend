import { ReturnMessage } from '@/components/layout/return-message';
import { PageShell } from '@/components/layout/page-shell';
export default function PaymentPage() {
  return <PageShell><ReturnMessage kind="payment" /></PageShell>;
}
