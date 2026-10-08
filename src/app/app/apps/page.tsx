import type { Metadata } from "next";
import { Apps } from "@/components/app/screens/Apps";

export const metadata: Metadata = { title: "Apps" };

export default function Page() {
  return <Apps />;
}
