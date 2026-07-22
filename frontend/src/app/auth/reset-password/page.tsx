import { Suspense } from "react";
import { ResetPasswordStep } from "@/components/ResetPasswordStep";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordStep />
    </Suspense>
  );
}
