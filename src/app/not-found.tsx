import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <SearchX className="size-12 text-muted-foreground" />
      <h1 className="font-display text-3xl font-bold">Not in the vault</h1>
      <p className="text-muted-foreground">We couldn&apos;t find that page, card or collector.</p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/packs">Open packs</Link>
        </Button>
      </div>
    </div>
  );
}
