import type { Metadata } from "next";
import { Activity } from "@/components/app/screens/Activity";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return <Activity />;
}
