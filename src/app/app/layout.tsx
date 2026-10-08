import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { ContextPassProvider } from "@/lib/contextpass/store";

export const metadata: Metadata = {
  title: { default: "Overview", template: "%s · ContextPass" },
};

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <ContextPassProvider>
      <AppShell>{children}</AppShell>
    </ContextPassProvider>
  );
}
