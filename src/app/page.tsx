import Link from "next/link";
import { AuthorityStack } from "@/components/landing/AuthorityStack";
import { ChooseContext } from "@/components/landing/ChooseContext";
import { LandingNav } from "@/components/landing/LandingNav";
import { RequestDemo } from "@/components/landing/RequestDemo";
import { Wordmark } from "@/components/brand/Wordmark";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { LedgerEntry, LedgerSpine } from "@/components/ui/LedgerEntry";
import { Microprint, StatusTag } from "@/components/ui/marks";
import { calendarDate, DEMO_EPOCH } from "@/lib/contextpass/clock";
import { EXAMPLE_LEDGER, exampleApp } from "@/lib/contextpass/examples";
import type { PermissionStatus } from "@/lib/contextpass/types";

const Container = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[80rem] px-[var(--gutter)] ${className}`}>{children}</div>
);

/** Section opener: a hairline, an index and a name. */
function SectionHead({ index, label, night = false }: { index: string; label: string; night?: boolean }) {
  return (
    <div className={`flex items-baseline gap-3 border-t pt-4 ${night ? "border-night-line" : "border-ink"}`}>
      <span className={`type-mono ${night ? "text-night-muted" : "text-muted"}`}>{index}</span>
      <span className={`type-label ${night ? "text-night-text" : "text-ink"}`}>{label}</span>
    </div>
  );
}

/** The period: the user's last word. Always oxide. */
const Dot = ({ night = false }: { night?: boolean }) => (
  <span className={night ? "text-oxide-night" : "text-oxide"}>.</span>
);

const STEPS: { n: string; title: string; body: string; states: PermissionStatus[]; yours?: boolean }[] = [
  {
    n: "01",
    title: "AI asks.",
    body: "An app requests specific context. It has to say what it wants, why, and for how long.",
    states: ["pending"],
  },
  {
    n: "02",
    title: "You decide.",
    body: "Allow all of it, some of it, or none. Shorten the time. Nothing is shared until you do.",
    states: ["active", "denied"],
    yours: true,
  },
  {
    n: "03",
    title: "You stay in control.",
    body: "Revoke access whenever you choose. Every grant also expires on its own.",
    states: ["revoked", "expired"],
  },
];

export default function Home() {

  return (
    <>
      <LandingNav />

      <main id="main">
        {/* ───────────── Hero ───────────── */}
        <section aria-labelledby="hero-title" className="pb-[var(--section-y)] pt-10 sm:pt-14 lg:pt-16">
          <Container>
            <div className="grid gap-x-8 gap-y-16 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <p className="type-label flex items-center gap-2 text-ink-2">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-oxide" />
                  A permission layer for AI applications
                </p>

                <h1
                  id="hero-title"
                  className="type-hero mt-6 text-[clamp(3.5rem,16.5vw,6.5rem)] lg:mt-8 lg:text-[clamp(5.25rem,9.3vw,9rem)]"
                >
                  <span className="block">
                    Your context<Dot />
                  </span>
                  <span className="block">
                    Your control<Dot />
                  </span>
                </h1>

                <p className="type-lede mt-8 text-ink lg:mt-10">
                  Give AI exactly what you choose. <span className="text-muted">Nothing more.</span>
                </p>
                <p className="type-body mt-3 max-w-[30rem] text-ink-2">
                  ContextPass sits between you and your AI apps. Apps ask for context. You decide what they see and for
                  how long, and you can take it back.
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-7">
                  <ButtonLink href="/connect" size="lg">
                    Connect ContextPass
                  </ButtonLink>
                  <a href="#how" className="group type-action inline-flex h-12 items-center gap-2 self-start sm:self-auto">
                    See how it works <Arrow dir="down" />
                  </a>
                </div>
              </div>

              <div className="max-w-[36rem] lg:col-span-5 lg:max-w-none">
                <AuthorityStack />
              </div>
            </div>
          </Container>
        </section>

        {/* ───────────── How it works ───────────── */}
        <section id="how" aria-labelledby="how-title" className="pb-[var(--section-y)]">
          <Container>
            <SectionHead index="01" label="How it works" />
            <div className="mt-8 grid gap-8 lg:grid-cols-12">
              <h2 id="how-title" className="type-display max-w-[14ch] lg:col-span-7">
                Access is asked for. Never assumed<Dot />
              </h2>
              <p className="type-body max-w-[26rem] self-end text-ink-2 lg:col-span-4 lg:col-start-9">
                AI apps work better when they know you. Today that means pasting your context in again and again, or
                handing it over for good. ContextPass makes them ask.
              </p>
            </div>

            <ol className="mt-14 grid border-t border-line md:grid-cols-3 lg:mt-20">
              {STEPS.map((s, i) => (
                <li
                  key={s.n}
                  className={`flex flex-col py-8 md:px-8 md:first:pl-0 md:last:pr-0 ${i > 0 ? "border-t border-line md:border-l md:border-t-0" : ""}`}
                >
                  <span className={`type-numeral ${s.yours ? "text-oxide" : "text-ink/25"}`}>{s.n}</span>
                  <h3 className="type-headline mt-8">{s.title}</h3>
                  <p className="type-body mt-3 max-w-[22rem] text-ink-2">{s.body}</p>
                  <p className="mt-auto flex flex-wrap gap-2 pt-8" aria-label="Resulting status">
                    {s.states.map((st) => (
                      <StatusTag key={st} status={st} />
                    ))}
                  </p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* ───────────── The request ───────────── */}
        <section id="request" aria-labelledby="request-title" className="on-night bg-night py-[var(--section-y)] text-night-text">
          <Container>
            <SectionHead index="02" label="The request" night />
            <div className="mt-8 grid gap-14 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-5">
                <h2 id="request-title" className="type-display max-w-[11ch]">
                  Every app has to ask<Dot night />
                </h2>
                <p className="type-lede mt-8 text-night-text">Every answer is yours.</p>
                <p className="type-body mt-3 max-w-[26rem] text-night-muted">
                  A request names the app, the exact context it wants, and how long it wants it. Untick a scope, shorten
                  the time, or say no.
                </p>
                <p className="type-small mt-10 max-w-[26rem] border-t border-night-line pt-4 text-night-muted">
                  <span className="text-night-text">Try it here — this rehearsal records nothing.</span> In the app, your
                  Allow is recorded on Monad. Private context is never pre-selected.
                </p>
              </div>

              <div className="lg:col-span-6 lg:col-start-7">
                <RequestDemo />
              </div>
            </div>
          </Container>
        </section>

        {/* ───────────── Your control ───────────── */}
        <section id="control" aria-labelledby="control-title" className="py-[var(--section-y)]">
          <Container>
            <SectionHead index="03" label="Your control" />
            <div className="mt-8 grid gap-8 lg:grid-cols-12">
              <h2 id="control-title" className="type-display max-w-[13ch] lg:col-span-7">
                You decide what AI gets to know<Dot />
              </h2>
              <p className="type-body max-w-[26rem] self-end text-ink-2 lg:col-span-4 lg:col-start-9">
                Your context is sorted into a few plain categories. Share one, keep the rest. An app only ever sees the
                part you chose.
              </p>
            </div>
            <div className="mt-14 lg:mt-20">
              <ChooseContext />
            </div>
          </Container>
        </section>

        {/* ───────────── For AI apps ───────────── */}
        <section id="developers" aria-labelledby="dev-title" className="border-t border-line bg-paper-2 py-[var(--section-y)]">
          <Container>
            <SectionHead index="04" label="For AI applications" />
            <div className="mt-8 grid gap-14 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-5">
                <h2 id="dev-title" className="type-display">
                  <span className="block">One permission layer.</span>
                  <span className="block">
                    Any AI app<Dot />
                  </span>
                </h2>
                <p className="type-body mt-8 max-w-[28rem] text-ink-2">
                  Apps don’t keep a copy of you. They ask ContextPass, receive the context they were granted, and lose it
                  when access ends.
                </p>
                <p className="type-body mt-4 max-w-[28rem] text-ink-2">
                  Permission state is recorded on Monad, so anyone it concerns can check a grant or a revocation. Your
                  context itself never goes on-chain — only who allowed which app, what scope, and until when.
                </p>
              </div>

              <div className="min-w-0 lg:col-span-6 lg:col-start-7">
                <div className="border border-ink bg-paper">
                  <div className="flex items-center justify-between border-b border-ink px-5 py-3">
                    <p className="type-system">Permission interface</p>
                    <p className="type-mono text-muted">Monad testnet</p>
                  </div>
                  <dl className="divide-y divide-line">
                    {[
                      ["grantPermission(app, scopes, expiry)", "→ permissionId", "Written when you allow."],
                      ["revokePermission(permissionId)", "→ void", "Written when you take it back."],
                      ["isPermissionActive(permissionId)", "→ bool", "Checked before every read."],
                    ].map(([sig, ret, note]) => (
                      <div key={sig} className="px-5 py-4">
                        <dt className="type-mono text-[0.8125rem] text-ink">{sig}</dt>
                        <dd className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                          <span className="type-mono text-muted">{ret}</span>
                          <span className="type-small text-ink-2">{note}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <pre className="type-mono mt-3 overflow-x-auto border border-line bg-paper/50 px-5 py-4 text-[0.8125rem] leading-[1.7] text-ink-2">
                  <code>
                    <span className="text-muted">{"// inside StudyOS"}</span>
                    {"\n"}const access = await contextpass.request({"{"}
                    {"\n"}  scopes: [&quot;preferences.learning&quot;, &quot;memory.study&quot;],
                    {"\n"}  duration: &quot;1h&quot;,
                    {"\n"}  reason: &quot;To tailor tonight’s revision plan.&quot;,
                    {"\n"}{"})"}
                  </code>
                </pre>
              </div>
            </div>

            {/* Four items: always complete rows at 1, 2 or 4 columns, so hairline gaps work. */}
            <dl className="mt-16 grid gap-px border-y border-ink bg-line sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
              {[
                ["Scoped", "Apps name the context they want. They get that, not more."],
                ["Expiring", "Every grant carries an end time. Access stops on its own."],
                ["Revocable", "Take access back in one step. It ends on the next read."],
                ["Verifiable", "Grants and revocations are recorded on Monad, with a transaction to check."],
              ].map(([term, def]) => (
                <div key={term} className="bg-paper-2 py-6 sm:px-6 sm:[&:nth-child(odd)]:pl-0 lg:[&:nth-child(odd)]:pl-6 lg:first:!pl-0">
                  <dt className="type-title">{term}</dt>
                  <dd className="type-small mt-2 max-w-[18rem] text-ink-2">{def}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>

        {/* ───────────── Ledger ───────────── */}
        <section aria-labelledby="ledger-title" className="py-[var(--section-y)]">
          <Container>
            <SectionHead index="05" label="The ledger" />
            <div className="mt-8 grid gap-14 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-5">
                <h2 id="ledger-title" className="type-display max-w-[11ch]">
                  Every access leaves a record<Dot />
                </h2>
                <p className="type-body mt-8 max-w-[24rem] text-ink-2">
                  Who asked, what they saw, and when it ended. Kept for you, readable by you.
                </p>
                <Link href="/app/activity" className="group type-action mt-8 inline-flex items-center gap-2">
                  Open the ledger <Arrow />
                </Link>
              </div>
              <div className="lg:col-span-7">
                <div className="flex items-baseline justify-between border-b border-ink pb-3">
                  <span className="type-label">Example ledger</span>
                  <span className="type-mono text-muted">{calendarDate(DEMO_EPOCH)}</span>
                </div>
                <ol className="relative">
                  <LedgerSpine />
                  {EXAMPLE_LEDGER.slice(0, 5).map((e) => (
                    <LedgerEntry key={e.id} event={e} app={exampleApp(e.appId)} compact showSource={false} />
                  ))}
                </ol>
              </div>
            </div>
          </Container>
        </section>

        {/* ───────────── Closing ───────────── */}
        <section aria-labelledby="closing-title" className="on-night bg-night py-[var(--section-y)] text-night-text">
          <Container>
            <h2 id="closing-title" className="type-hero text-[clamp(3.25rem,13vw,8.5rem)]">
              <span className="block text-night-muted">
                AI can ask<Dot night />
              </span>
              <span className="block">
                You decide<Dot night />
              </span>
            </h2>
            <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <ButtonLink href="/connect" variant="solid-night" size="lg">
                Connect ContextPass
              </ButtonLink>
              <ButtonLink href="/app" variant="outline-night" size="lg" className="group">
                Explore the app <Arrow />
              </ButtonLink>
            </div>
          </Container>
        </section>
      </main>

      <footer className="bg-night pb-10 text-night-muted">
        <Container>
          <Microprint className="border-y border-night-line py-2 text-night-line" />
          <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Wordmark night />
              <p className="type-small mt-3 max-w-[22rem]">The permission layer between people and their AI applications.</p>
            </div>
            <div className="type-mono flex flex-col gap-1 sm:items-end">
              <span>Permissions on Monad Testnet</span>
              <span>Metropolis Hackathon · Track 04</span>
            </div>
          </div>
        </Container>
      </footer>
    </>
  );
}
