import { permanentRedirect } from "next/navigation";

export default async function LegacyMarketplaceProductRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/projects/${id}`);
}
