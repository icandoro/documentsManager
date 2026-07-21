import { AdminPlatformManager } from "@/components/AdminPlatformManager";
import { AppShell } from "@/components/AppShell";

export default function AdminUsersPage() {
  return (
    <AppShell>
      <AdminPlatformManager section="users" />
    </AppShell>
  );
}
