import { PackArt } from "@/components/packs/pack-art";
import { FICTIONAL_DISCLAIMER } from "@/lib/constants";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
      <div className="relative hidden h-[520px] lg:block" aria-hidden>
        <div className="absolute left-[8%] top-[10%] w-[38%] -rotate-12 animate-float [animation-delay:-2s]">
          <PackArt theme="trainer" name="Trainer Pack" cards={5} />
        </div>
        <div className="absolute left-[32%] top-[2%] z-10 w-[40%] animate-float">
          <PackArt theme="legendary" name="Legendary Pack" cards={5} />
        </div>
        <div className="absolute right-[4%] top-[14%] w-[36%] rotate-12 animate-float [animation-delay:-4s]">
          <PackArt theme="master" name="Master Pack" cards={3} />
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-2 text-center">
          <p className="font-display text-2xl font-bold">Rip packs. Chase grails. Zero real money.</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{FICTIONAL_DISCLAIMER}</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="surface rounded-2xl border bg-card p-6 shadow-2xl sm:p-8">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
