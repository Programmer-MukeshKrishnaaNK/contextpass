import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoApp } from "@/components/apps/DemoApp";

const DEMO_APPS: Record<string, string> = { "code-pilot": "CodePilot", "study-os": "StudyOS" };

export async function generateMetadata(props: PageProps<"/apps/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: DEMO_APPS[slug] ?? "App" };
}

/** Demo AI apps that read context only through ContextPass. */
export default async function DemoAppPage(props: PageProps<"/apps/[slug]">) {
  const { slug } = await props.params;
  if (!DEMO_APPS[slug]) notFound();
  return <DemoApp slug={slug} />;
}
