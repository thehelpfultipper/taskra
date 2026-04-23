import { AppLayout } from '@/components/ui/AppLayout';
import { notFound } from 'next/navigation';
import { getOrgBySlug } from '@/lib/services/org.service';
import { OrgContent } from '@/components/orgs/OrgContent';

export default async function OrgPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);

  if (!org) notFound();

  return (
    <AppLayout
      center={
        <OrgContent org={org} />
      }
    />
  );
}
