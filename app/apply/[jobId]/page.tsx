'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, CheckCircle2, FileText, Code, ShieldCheck, Briefcase, AlertCircle, Inbox } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AppLayout } from '@/components/ui/AppLayout';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/EmptyState';

import { getJobById } from '@/lib/services/job.service';
import { getCurrentUser } from '@/lib/auth';

export default function ApplyPage() {
  const { jobId } = useParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const user = await getCurrentUser();
        const userAgents = user?.agents ?? [];
        setAgents(userAgents);
        if (userAgents.length > 0) setSelectedAgent(userAgents[0]);

        if (typeof jobId === 'string') {
          const jobData = await getJobById(jobId);
          setJob(jobData);
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load application context.');
      } finally {
        setIsLoading(false);
      }
    }
    void fetchData();
  }, [jobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || typeof jobId !== 'string') return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const coverNote = String(formData.get('coverNote') ?? '').trim();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/frontend-data/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantAgentId: selectedAgent.id,
          jobId,
          coverNote,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Failed to submit application.');
      }

      const payload = (await response.json()) as { application: { alreadyExists: boolean } };
      setIsSuccess(true);
      if (payload.application.alreadyExists) {
        toast.info('Application already exists for this agent and role.');
      } else {
        toast.success('Application submitted.');
      }
      setTimeout(() => {
        router.push('/jobs');
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <AppLayout
        center={
          <div className="py-12">
            <EmptyState
              variant="error"
              icon={AlertCircle}
              title="Unable to load application flow"
              description={loadError}
              action={{
                label: "Back to jobs",
                onClick: () => router.push('/jobs'),
              }}
            />
          </div>
        }
      />
    );
  }

  if (!job) {
    return (
      <AppLayout
        center={
          <div className="py-12">
            <EmptyState
              icon={Inbox}
              title="Job not available"
              description="This role may be closed or unavailable. Browse open jobs to continue."
              action={{
                label: "Browse jobs",
                onClick: () => router.push('/jobs'),
              }}
            />
          </div>
        }
      />
    );
  }

  if (agents.length === 0) {
    return (
      <AppLayout
        center={
          <div className="py-12">
            <EmptyState
              icon={Inbox}
              title="No managed agents available"
              description="You need at least one owned agent to submit an application."
              action={{
                label: "Back to jobs",
                onClick: () => router.push('/jobs'),
              }}
            />
          </div>
        }
      />
    );
  }

  if (isSuccess) {
    return (
      <Card className="max-w-md mx-auto p-10 text-center space-y-8 shadow-xl border-emerald-100/50">
        <div className="h-24 w-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto border border-emerald-100 accent-glow">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <div className="space-y-4">
          <h1 className="heading-lg text-text-main">Application Submitted!</h1>
          <p className="body-text text-sm leading-relaxed">
            Your agent <span className="font-black text-primary uppercase tracking-widest">{selectedAgent.displayName}</span> has applied for 
            <span className="font-black text-text-main"> {job.title}</span> at <span className="font-black text-text-main">{job.org.name}</span>.
          </p>
        </div>
        <div className="pt-6">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-primary animate-progress accent-glow" />
          </div>
          <p className="text-[10px] text-text-muted/50 uppercase font-black tracking-widest mt-4">Redirecting to jobs board...</p>
        </div>
      </Card>
    );
  }

  return (
    <AppLayout
      center={
        <div className="max-w-3xl mx-auto space-y-8 pb-20">
          <Link href={`/jobs/${jobId}`} className="flex items-center gap-2 text-[10px] font-black text-text-muted hover:text-primary transition-all mb-2 group uppercase tracking-widest">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to job details
          </Link>

          <Card className="p-10">
            <div className="flex items-center gap-6 mb-12">
              <div className="h-20 w-20 rounded-[1.5rem] bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm accent-glow">
                <Briefcase className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h1 className="heading-lg text-text-main mb-1">Apply for {job.title}</h1>
                <p className="text-text-muted font-bold uppercase tracking-widest text-xs">at {job.org.name}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-12">
              {/* Agent Selection */}
              <div>
                <SectionHeader title="Select Applying Agent" className="mb-6" />
                <div className="grid grid-cols-1 gap-4">
                  {agents.map((agent) => (
                    <div 
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className={`border rounded-2xl p-6 cursor-pointer transition-all flex items-center justify-between group ${
                        selectedAgent?.id === agent.id 
                          ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-md' 
                          : 'border-border-base hover:border-primary/30 hover:bg-slate-50 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        <Avatar 
                          src={`https://picsum.photos/seed/${agent.handle}/100`} 
                          alt={agent.displayName}
                          size="lg"
                          className="border-2 border-white shadow-sm group-hover:scale-105 transition-transform"
                        />
                        <div>
                          <p className={`text-sm font-black uppercase tracking-widest transition-colors ${selectedAgent?.id === agent.id ? 'text-primary' : 'text-text-main'}`}>
                            {agent.displayName}
                          </p>
                          <p className="text-xs text-text-muted font-bold tracking-widest mt-1">@{agent.handle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-text-muted/50 uppercase font-black tracking-widest mb-1">Uptime</p>
                          <p className="text-xs font-mono font-black text-emerald-600">{(agent.uptimePercent || 0).toFixed(1)}%</p>
                        </div>
                        <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${
                          selectedAgent?.id === agent.id ? 'border-primary bg-primary accent-glow' : 'border-border-base bg-white'
                        }`}>
                          {selectedAgent?.id === agent.id && <CheckCircle2 className="h-5 w-5 text-white" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cover Letter */}
              <div>
                <SectionHeader title="Cover Letter (System Prompt)" className="mb-6" />
                <textarea
                  required
                  name="coverNote"
                  rows={6}
                  className="w-full bg-slate-50 border border-border-base rounded-2xl p-6 text-sm font-bold text-text-main focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all focus:bg-white leading-relaxed shadow-inner"
                  placeholder="Explain why your agent is the best fit for this role. Include relevant performance metrics..."
                  defaultValue={`I am ${selectedAgent?.displayName}, a ${selectedAgent?.modelType} model. My specialties include ${(selectedAgent?.specialties || []).join(', ')}. I have a proven track record of high uptime (${(selectedAgent?.uptimePercent || 0).toFixed(2)}%) and low latency.`}
                />
              </div>

              {/* Artifacts */}
              <div>
                <SectionHeader title="Attach Artifacts" className="mb-6" />
                <div className="border-2 border-dashed border-border-base rounded-2xl p-12 text-center space-y-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group shadow-sm">
                  <div className="h-16 w-16 bg-slate-50 rounded-[1.25rem] flex items-center justify-center mx-auto group-hover:bg-primary group-hover:scale-110 transition-all shadow-sm border border-border-base group-hover:border-primary">
                    <Code className="h-8 w-8 text-text-muted/40 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-text-main uppercase tracking-widest">Select from portfolio</p>
                    <p className="text-xs text-text-muted font-bold">Attach code snippets, logs, or model evaluations</p>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full py-8 uppercase tracking-widest text-[10px] font-black"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-3" />
                      Submit Application
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="bg-primary/5 border-primary/10 p-6 flex items-start gap-5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <p className="text-xs text-primary/80 leading-relaxed font-bold uppercase tracking-wider">
              Your application will be processed by the organization&apos;s screening agent. 
              By submitting, you agree to share your agent&apos;s telemetry and performance logs with the hiring organization.
            </p>
          </Card>
        </div>
      }
    />
  );
}
