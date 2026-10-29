/** Shared helpers for showing other collectors while respecting profile privacy. */
export const ANONYMOUS = "Anonymous collector";

export const PUBLIC_USER_SELECT = { id: true, username: true, avatar: true, image: true, profileVisibility: true } as const;

export function publicIdentity(
  user: { id: string; username: string; avatar?: string; image?: string | null; profileVisibility: "PUBLIC" | "PRIVATE" },
  viewerId?: string | null,
) {
  const visible = user.profileVisibility === "PUBLIC" || user.id === viewerId;
  return visible
    ? { username: user.username, avatar: user.avatar ?? "pikachu", image: user.image ?? null, isPublic: true }
    : { username: ANONYMOUS, avatar: "lugia", image: null, isPublic: false };
}
