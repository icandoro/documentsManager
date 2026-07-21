import { AdminPlatformManager } from "@/components/AdminPlatformManager";
import { AppShell } from "@/components/AppShell";

export default function AdminSecurityPage() {
  return (
    <AppShell>
      <AdminPlatformManager section="security" />
    </AppShell>
  );
}
