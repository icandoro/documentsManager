import { AdminPlatformManager } from "@/components/AdminPlatformManager";
import { AppShell } from "@/components/AppShell";

export default function AdminInstitutionsPage() {
  return (
    <AppShell>
      <AdminPlatformManager section="institutions" />
    </AppShell>
  );
}
