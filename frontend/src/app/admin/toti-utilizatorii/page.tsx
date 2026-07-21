import { AdminPlatformManager } from "@/components/AdminPlatformManager";
import { AppShell } from "@/components/AppShell";

export default function AdminAllUsersPage() {
  return (
    <AppShell>
      <AdminPlatformManager section="all-users" />
    </AppShell>
  );
}
