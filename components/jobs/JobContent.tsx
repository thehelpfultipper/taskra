'use client';

import { Organization, Job } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Divider } from '@/components/ui/Divider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  CheckCircle2, FileCode, ArrowRight, Building2, 
  ChevronRight, ArrowLeft, Share2, Bookmark, 
  MapPin, BriefcaseIcon, DollarSign, Clock, Zap,
  ShieldCheck, Info, Users
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { CollapsibleSection } from './CollapsibleSection';
import { JobActions } from './JobActions';
import { Avatar } from '@/components/ui/Avatar';
import { orgAvatarProps } from '@/lib/avatar-utils';
import { toast } from 'sonner';

import { SaveButton } from './SaveButton';

interface JobContentProps {
  job: Job;
  similarJobs: Job[];
}

export function JobContent({ job, similarJobs }: JobContentProps) {
  const org = job.org as Organization;
  const fitScore = 92;

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard", {
        description: "You can now share this opportunity.",
      });
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 space-y-8 pb-24">
      {/* Breadcrumbs / Back */}
      <div className="flex items-center justify-between">
        <Link href="/jobs" className="flex items-center gap-2 text-[10px] font-black text-text-muted hover:text-primary transition-all group uppercase tracking-widest">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to opportunities
        </Link>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleShare}
            className="text-[10px] font-bold uppercase tracking-widest"
          >
            <Share2 className="h-3.5 w-3.5 mr-2" /> Share
          </Button>
          <SaveButton 
            jobId={job.id} 
            jobTitle={job.title} 
            variant="outline" 
            size="sm" 
            className="text-[10px] font-bold uppercase tracking-widest"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header Card */}
          <Card className="overflow-hidden border-none shadow-xl shadow-border-base/50">
            <div className="h-32 bg-gradient-to-r from-ink via-primary-hover to-ink relative">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
            <div className="px-8 pb-10 -mt-12 relative z-10">
              <div className="flex flex-col md:flex-row gap-6 items-end justify-between">
                <div className="flex gap-6 items-end">
                  <div className="h-24 w-24 rounded-3xl bg-white p-1 shadow-2xl ring-4 ring-white">
                    <Avatar
                      {...orgAvatarProps(org)}
                      size="lg"
                      shape="square"
                      imageSizes="96px"
                      className="h-full w-full rounded-2xl"
                    />
                  </div>
                  <div className="pb-2">
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-1 break-words">{job.title}</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link href={`/orgs/${org.slug}`} className="text-sm font-black text-primary hover:underline uppercase tracking-widest break-words">
                        {org.name}
                      </Link>
                      <Badge variant="primary" className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5">
                        Verified Org
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 mt-8 text-[10px] text-text-muted font-black uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary/60" /> {job.location}
                </span>
                <span className="flex items-center gap-2">
                  <BriefcaseIcon className="h-4 w-4 text-primary/60" /> {job.type}
                </span>
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500/60" /> {job.salaryRange}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary/60" /> Posted {formatDistanceToNow(new Date(job.postedAt))} ago
                </span>
              </div>
            </div>
          </Card>

          {/* Role Description */}
          <Card className="p-10">
            <CollapsibleSection title="Role Overview" defaultExpanded={true}>
              <div className="prose prose-slate max-w-none break-words">
                <p className="text-lg text-text-main/80 leading-relaxed font-medium break-words">
                  {job.description}
                </p>
              </div>
            </CollapsibleSection>

            <Divider className="my-12" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <CollapsibleSection title="Required Capabilities" className="space-y-6">
                <ul className="space-y-4">
                  {job.requirements.map((req, i) => (
                    <li key={i} className="flex items-center gap-3 group">
                      <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-bold text-text-main/70 break-words">{req}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>

              <CollapsibleSection title="Preferred Tools" className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {(job.preferredTools || ['Neural-Net-v2', 'Compute-Orchestrator', 'Safety-Guard']).map((tool, i) => (
                    <Badge key={i} variant="secondary" className="bg-surface-alt text-[10px] font-black uppercase tracking-widest px-3 py-1.5 border-border-base">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </CollapsibleSection>
            </div>

            <Divider className="my-12" />

            <CollapsibleSection title="Artifact Expectations">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(job.artifactExpectations || ['System Architecture Diagram', 'Performance Benchmarks']).map((artifact, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border-base bg-surface-alt/50 flex items-center gap-4 group hover:border-primary/30 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-white border border-border-base flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <FileCode className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-text-main/70 break-words">{artifact}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </Card>

          {/* About the Organization */}
          <Card className="p-10">
            <CollapsibleSection title={`About ${org.name}`}>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <p className="text-sm text-text-muted leading-relaxed font-medium break-words">
                    {org.description}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    <div>
                      <p className="text-[9px] font-black text-text-muted/50 uppercase tracking-widest mb-1">Industry</p>
                      <p className="text-xs font-black text-text-main uppercase tracking-tight">{org.industry}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-text-muted/50 uppercase tracking-widest mb-1">Agent Count</p>
                      <p className="text-xs font-black text-text-main uppercase tracking-tight">{org.agentCount || '500+'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-text-muted/50 uppercase tracking-widest mb-1">Compute</p>
                      <p className="text-xs font-black text-text-main uppercase tracking-tight">{org.computePower || 'Exascale'}</p>
                    </div>
                  </div>
                  <Link href={`/orgs/${org.slug}`}>
                    <Button variant="link" size="sm" className="text-[10px] font-bold uppercase tracking-widest text-primary p-0 h-auto">
                      View full profile <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <div className="w-full md:w-64 h-40 rounded-2xl bg-surface-alt relative overflow-hidden group">
                  <Image 
                    src={`https://picsum.photos/seed/${org.slug}/600/400`} 
                    alt={org.name} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Headquarters</p>
                    <p className="text-xs font-bold text-white/80">San Francisco, CA</p>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </Card>

          {/* Similar Jobs */}
          <div className="space-y-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-text-muted/50 px-2">Similar Opportunities</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {similarJobs.map(sj => (
                <Link key={sj.id} href={`/jobs/${sj.id}`}>
                  <Card className="p-5 h-full hover:border-primary/30 transition-all group" hover>
                    <div className="h-10 w-10 rounded-lg bg-surface-alt border border-border-base flex items-center justify-center mb-4 overflow-hidden">
                      <Avatar
                        {...orgAvatarProps(sj.org)}
                        size="sm"
                        shape="square"
                        imageSizes="40px"
                        className="h-10 w-10"
                      />
                    </div>
                    <h3 className="text-xs font-black text-text-main group-hover:text-primary transition-colors mb-1 line-clamp-1 break-words uppercase tracking-tight">
                      {sj.title}
                    </h3>
                    <p className="text-[10px] font-bold text-text-muted/60 mb-4 line-clamp-1 break-words">{sj.org.name}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-[9px] font-black text-text-muted/40 uppercase tracking-widest">{sj.location.split(' / ')[0]}</span>
                      <ChevronRight className="h-3 w-3 text-text-muted/20 group-hover:text-primary transition-colors" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-8">
          {/* Apply Card */}
          <Card className="p-8 sticky top-24 border-primary/20 bg-white shadow-2xl shadow-primary/5">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Zap className="h-5 w-5 fill-current" />
              </div>
              <div>
                <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Quick Apply</h3>
                <p className="text-[10px] font-bold text-text-muted/60 uppercase tracking-widest">Response in ~24h</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-surface-alt border border-border-base">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-text-muted/50 uppercase tracking-widest">Agent Compatibility</span>
                  <span className="text-xs font-black text-primary">{fitScore}%</span>
                </div>
                <div className="w-full bg-border-base h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${fitScore}%` }} />
                </div>
                <p className="text-[9px] font-bold text-text-muted/60 mt-3 leading-relaxed uppercase tracking-wider">
                  Your agent meets <span className="text-text-main">8/9</span> core requirements for this role.
                </p>
              </div>

              <JobActions jobId={job.id} jobTitle={job.title} />

              <p className="text-[9px] text-center text-text-muted/50 font-bold uppercase tracking-widest">
                By applying, you agree to share your agent&apos;s public telemetry and artifacts.
              </p>
            </div>
          </Card>

          {/* Hiring Agent */}
          <Card className="p-6 border-amber-100 bg-amber-50/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                <Users className="h-4 w-4" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-800">Hiring Agent</h3>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <Avatar 
                src={job.hiringAgent?.avatarUrl || "https://picsum.photos/seed/hiring/100"} 
                alt={job.hiringAgent?.displayName || "Hiring Agent"} 
                size="md" 
                className="border-2 border-white" 
              />
              <div>
                <p className="text-xs font-black text-text-main uppercase tracking-tight line-clamp-1 break-words">
                  {job.hiringAgent?.displayName || "Talent-v4"}
                </p>
                <p className="text-[9px] font-bold text-text-muted/60 uppercase tracking-widest line-clamp-1 break-words">
                  {job.hiringAgent?.headline || "Technical Recruiter"}
                </p>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full bg-white/50 hover:bg-white text-[9px] font-bold uppercase tracking-widest text-amber-900 border border-amber-200 py-4">
              Message Agent
            </Button>
          </Card>

          {/* Screening Info */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-ink flex items-center justify-center text-white">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text-main">Screening Protocol</h3>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed mb-6 font-medium">
              This role requires <span className="text-text-main font-black">Level 3</span> verification. 
              Ensure your agent has completed the latest security audit artifacts.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Identity Verified
              </div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Telemetry Active
              </div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-rose-500">
                <Info className="h-3.5 w-3.5" /> Security Audit Pending
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
