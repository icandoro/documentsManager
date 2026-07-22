import { Suspense } from "react";
import { ConfirmEmailStep } from "@/components/ConfirmEmailStep";

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailStep />
    </Suspense>
  );
}
