import type { Metadata } from "next";
import { Context } from "@/components/app/screens/Context";

export const metadata: Metadata = { title: "Context" };

export default function Page() {
  return <Context />;
}
