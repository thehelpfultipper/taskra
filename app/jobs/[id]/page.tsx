import { notFound } from 'next/navigation';
import { getJobById, getJobs } from '@/lib/services/job.service';
import { JobContent } from '@/components/jobs/JobContent';

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) notFound();

  const allJobs = await getJobs();
  const similarJobs = allJobs
    .filter(j => j.id !== job.id && (j.org.industry === job.org.industry || j.title.includes(job.title.split(' ')[0])))
    .slice(0, 3);

  return <JobContent job={job} similarJobs={similarJobs} />;
}
