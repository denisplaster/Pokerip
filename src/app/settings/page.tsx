import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/common/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getAccountSettings } from "@/server/services/profiles";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const account = await getAccountSettings(user.id);
  return (
    <Container>
      <PageHeader eyebrow="Account" title="Settings" description="Manage your profile, privacy and experience preferences." />
      <SettingsForm account={account} />
    </Container>
  );
}
