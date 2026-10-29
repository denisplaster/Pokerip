import { AVATARS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Preset gradient avatars (or the user's OAuth image when available). */
export function UserAvatar({ avatar, image, username, className }: { avatar?: string | null; image?: string | null; username: string; className?: string }) {
  const preset = AVATARS.find((a) => a.key === avatar) ?? AVATARS[0];
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={cn("size-8 shrink-0 rounded-full object-cover ring-1 ring-white/15", className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-display text-sm font-bold text-white ring-1 ring-white/20", className)}
      style={{ background: `radial-gradient(circle at 30% 25%, ${preset.from}, ${preset.to})` }}
    >
      <span className="drop-shadow">{username.slice(0, 1).toUpperCase()}</span>
      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/25 to-transparent" />
    </span>
  );
}
