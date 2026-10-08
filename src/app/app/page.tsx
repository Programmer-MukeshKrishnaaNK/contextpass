import type { Metadata } from "next";
import { Overview } from "@/components/app/screens/Overview";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <Overview />;
}
