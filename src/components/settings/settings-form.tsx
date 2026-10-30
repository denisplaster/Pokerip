"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Eye, EyeOff, KeyRound, LoaderCircle, Save, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { AVATARS } from "@/lib/constants";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { passwordSchema, usernameSchema } from "@/lib/validators";
import { usePreferences } from "@/stores/preferences";

interface Account {
  username: string;
  email: string | null;
  bio: string | null;
  avatar: string;
  profileVisibility: "PUBLIC" | "PRIVATE";
  hasPassword: boolean;
  accounts: { provider: string }[];
}

export function SettingsForm({ account }: { account: Account }) {
  const router = useRouter();
  const [username, setUsername] = useState(account.username);
  const [bio, setBio] = useState(account.bio ?? "");
  const [avatar, setAvatar] = useState(account.avatar);
  const [visibility, setVisibility] = useState(account.profileVisibility);
  const prefs = usePreferences();

  const usernameError = username === account.username ? null : usernameSchema.safeParse(username).error?.issues[0]?.message;
  const save = useMutation({
    mutationFn: () => api("/api/profile", { method: "PATCH", body: { username, bio, avatar, profileVisibility: visibility } }),
    onSuccess: () => {
      toast.success("Profile saved");
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="surface space-y-6 rounded-2xl border bg-card p-6" aria-labelledby="profile-settings">
        <h2 id="profile-settings" className="font-display text-lg font-semibold">Profile</h2>
        <div className="space-y-2">
          <Label>Avatar</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar">
            {AVATARS.map((a) => (
              <button
                key={a.key}
                role="radio"
                aria-checked={avatar === a.key}
                aria-label={a.label}
                onClick={() => setAvatar(a.key)}
                className={cn("rounded-full p-0.5 ring-2 transition", avatar === a.key ? "ring-violet-400" : "ring-transparent hover:ring-white/20")}
              >
                <UserAvatar avatar={a.key} username={username || "?"} className="size-11 text-base" />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} aria-invalid={Boolean(usernameError)} />
          {usernameError ? <p className="text-xs text-red-300">{usernameError}</p> : <p className="text-xs text-muted-foreground">Shown on leaderboards and the activity feed.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={240} placeholder="What are you chasing?" />
          <p className="text-right text-[11px] text-muted-foreground">{bio.length}/240</p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              {visibility === "PUBLIC" ? <Eye className="size-4" /> : <EyeOff className="size-4" />} Public profile
            </p>
            <p className="text-xs text-muted-foreground">When off, your profile and showcase are hidden and you appear as “Anonymous collector” on leaderboards and feeds.</p>
          </div>
          <Switch checked={visibility === "PUBLIC"} onCheckedChange={(v) => setVisibility(v ? "PUBLIC" : "PRIVATE")} aria-label="Public profile" />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || Boolean(usernameError)}>
            {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Save profile
          </Button>
        </div>
      </section>

      <div className="space-y-6">
        <section className="surface space-y-5 rounded-2xl border bg-card p-6" aria-labelledby="pref-settings">
          <h2 id="pref-settings" className="font-display text-lg font-semibold">Experience</h2>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="sound">Sound effects</Label>
            <Switch id="sound" checked={!prefs.muted} onCheckedChange={(v) => prefs.setMuted(!v)} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Volume2 className="size-4" /> Volume
            </Label>
            <Slider value={[Math.round(prefs.volume * 100)]} onValueChange={([v]) => prefs.setVolume(v / 100)} onValueCommit={() => playSound("coin")} max={100} step={5} disabled={prefs.muted} aria-label="Volume" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="skip">Skip opening animations</Label>
              <p className="text-xs text-muted-foreground">Show results instantly.</p>
            </div>
            <Switch id="skip" checked={prefs.skipAnimations} onCheckedChange={prefs.setSkipAnimations} />
          </div>
        </section>
        <PasswordSection hasPassword={account.hasPassword} />
        <section className="surface space-y-2 rounded-2xl border bg-card p-6 text-sm">
          <h2 className="font-display text-lg font-semibold">Account</h2>
          <p className="text-muted-foreground">Email: {account.email ?? "—"}</p>
          <p className="text-muted-foreground">Sign-in: {[account.hasPassword ? "password" : null, ...account.accounts.map((a) => a.provider)].filter(Boolean).join(", ")}</p>
        </section>
      </div>
    </div>
  );
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const nextError = next ? passwordSchema.safeParse(next).error?.issues[0]?.message : null;
  const change = useMutation({
    mutationFn: () => api("/api/profile/password", { body: { currentPassword: current, newPassword: next } }),
    onSuccess: () => {
      toast.success("Password updated — please sign in again", { description: "All other sessions have been signed out." });
      setCurrent("");
      setNext("");
      setTimeout(() => void signOut({ redirectTo: "/login" }), 1200);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!hasPassword) return null;
  return (
    <section className="surface space-y-4 rounded-2xl border bg-card p-6" aria-labelledby="pw-settings">
      <h2 id="pw-settings" className="flex items-center gap-2 font-display text-lg font-semibold">
        <KeyRound className="size-4" /> Change password
      </h2>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nextError && current && next) change.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={Boolean(nextError)} />
          {nextError && <p className="text-xs text-red-300">{nextError}</p>}
        </div>
        <Button type="submit" variant="outline" disabled={!current || !next || Boolean(nextError) || change.isPending}>
          {change.isPending ? <LoaderCircle className="animate-spin" /> : <Check />} Update password
        </Button>
      </form>
    </section>
  );
}
