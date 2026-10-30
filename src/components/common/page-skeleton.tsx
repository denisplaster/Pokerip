import { Skeleton } from "@/components/ui/skeleton";

/** Generic loading state that mirrors the page header + grid layout. */
export function PageSkeleton({ cards = 12, columns = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" }: { cards?: number; columns?: string }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3 pb-6 pt-12">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className={`grid gap-4 ${columns}`}>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[63/88] w-full rounded-[5%]" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
