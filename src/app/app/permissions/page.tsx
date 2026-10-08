import type { Metadata } from "next";
import { Suspense } from "react";
import { Permissions } from "@/components/app/screens/Permissions";

export const metadata: Metadata = { title: "Permissions" };

export default function Page() {
  return (
    <Suspense>
      <Permissions />
    </Suspense>
  );
}
