import type { Metadata } from "next";
import { Container } from "@/components/common/page-header";
import { ProfileView } from "@/components/profile/profile-view";
import { orNotFound } from "@/server/page-helpers";
import { getProfile } from "@/server/services/profiles";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `${decodeURIComponent(username)}'s vault` };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getSessionUser();
  const profile = await orNotFound(getProfile(decodeURIComponent(username), viewer?.id ?? null));
  return (
    <Container>
      <ProfileView profile={profile} />
    </Container>
  );
}
