import { AppShell } from "@/components/AppShell";
import { TaxpayerProfileManager } from "@/components/TaxpayerProfileManager";

export default async function TaxpayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <TaxpayerProfileManager taxpayerId={id} />
    </AppShell>
  );
}
