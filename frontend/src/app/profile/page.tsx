import { AppShell } from "@/components/AppShell";
import { InstitutionsManager } from "@/components/InstitutionsManager";
import { ProfileManager } from "@/components/ProfileManager";

export default function ProfilePage() {
  return (
    <AppShell>
      <ProfileManager />
      <InstitutionsManager />
    </AppShell>
  );
}
