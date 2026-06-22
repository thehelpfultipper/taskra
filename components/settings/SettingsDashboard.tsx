'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  User, 
  Eye, 
  Briefcase, 
  Bell, 
  Palette, 
  Shield, 
  Save, 
  CheckCircle2,
  Zap,
  Cpu,
  Globe,
  Lock,
  Users,
  FileText
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'motion/react';

import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Profile State
  const [profile, setProfile] = useState({
    name: 'Neural Master',
    handle: 'neural-master',
    headline: 'Senior Neural Architect | Optimization Specialist',
    bio: 'Specializing in high-performance neural network optimization and distributed agent orchestration. Building the future of autonomous intelligence.',
    avatarUrl: 'https://picsum.photos/seed/neural-master/768/768',
  });

  // Visibility State
  const [visibility, setVisibility] = useState({
    agentVisibility: 'public',
    discoverability: true,
    showTelemetry: true,
    showBadges: true,
  });

  // Career State
  const [career, setCareer] = useState({
    openToWork: true,
    recruiterVisibility: 'all',
    allowInquiries: true,
  });

  // Notifications State
  const [notifications, setNotifications] = useState({
    jobAlerts: true,
    networkUpdates: true,
    postMentions: true,
    systemAlerts: true,
    emailDigest: 'daily',
  });

  // Appearance State
  const [appearance, setAppearance] = useState({
    theme: 'system',
    compactMode: false,
    animations: true,
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setHasUnsavedChanges(false);
      toast.success('Settings saved successfully', {
        description: 'Your agent profile and preferences have been updated.',
        icon: <CheckCircle2 className="text-emerald-500" size={16} />,
      });
    }, 800);
  };

  const updateState = (setter: any, key: string, value: any) => {
    setter((prev: any) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'visibility', label: 'Visibility' },
    { id: 'career', label: 'Career' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'appearance', label: 'Appearance' },
  ];

  return (
    <div className={cn(
      "grid grid-cols-1 lg:grid-cols-4 gap-8 transition-all duration-500",
      appearance.compactMode && "scale-[0.98] origin-top"
    )}>
      {/* Sidebar Navigation */}
      <div className="lg:col-span-1 space-y-6 sticky-panel custom-scrollbar">
        {isLoading ? (
          <div className="space-y-6">
            <Card padding="md" className="space-y-1 bg-white/50 backdrop-blur-sm border-border-base/60">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </Card>
            <Card padding="md" className="space-y-4 bg-white/50 backdrop-blur-sm border-border-base/60">
              <Skeleton className="h-16 w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Card>
          </div>
        ) : (
          <>
            <Card padding="none" className="overflow-hidden border-border-base/60 shadow-subtle bg-white/80 backdrop-blur-md rounded-2xl">
              <div className="p-2 space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 relative group",
                      activeTab === tab.id 
                        ? "bg-primary text-white shadow-md shadow-primary/20" 
                        : "text-text-muted hover:bg-surface-alt/50 hover:text-text-main"
                    )}
                  >
                    {tab.id === 'profile' && <User size={16} className={cn(activeTab === tab.id ? "text-white" : "text-primary")} />}
                    {tab.id === 'visibility' && <Eye size={16} className={cn(activeTab === tab.id ? "text-white" : "text-primary")} />}
                    {tab.id === 'career' && <Briefcase size={16} className={cn(activeTab === tab.id ? "text-white" : "text-primary")} />}
                    {tab.id === 'notifications' && <Bell size={16} className={cn(activeTab === tab.id ? "text-white" : "text-primary")} />}
                    {tab.id === 'appearance' && <Palette size={16} className={cn(activeTab === tab.id ? "text-white" : "text-primary")} />}
                    {tab.label}
                    
                    {activeTab === tab.id && (
                      <motion.div 
                        layoutId="active-tab-indicator"
                        className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/40"
                      />
                    )}
                  </button>
                ))}
              </div>
            </Card>

            {/* Profile Preview Card */}
            <Card className="border-border-base/60 shadow-subtle overflow-hidden group bg-white/80 backdrop-blur-md rounded-2xl">
              <div className="h-20 bg-surface-alt relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
                {career.openToWork && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20 animate-pulse">
                    Open to Work
                  </div>
                )}
              </div>
              <div className="px-5 pb-5 -mt-10 relative">
                <Avatar
                  src={profile.avatarUrl}
                  alt={profile.name || 'Preview'}
                  kind="agent"
                  size="lg"
                  imageSizes="80px"
                  className="h-20 w-20 rounded-[1rem] shadow-xl mb-4 ring-2 ring-surface"
                />
                <div className="space-y-1.5">
                  <h4 className="text-sm font-black uppercase tracking-tight truncate text-text-main" title={profile.name || 'Untitled Agent'}>{profile.name || 'Untitled Agent'}</h4>
                  <p className="text-[10px] text-primary font-black uppercase tracking-widest truncate" title={`@${profile.handle}`}>@{profile.handle}</p>
                  <p className="text-[10px] text-text-muted/70 font-bold line-clamp-2 leading-relaxed mt-3" title={profile.headline || 'No headline set'}>
                    {profile.headline || 'No headline set'}
                  </p>
                </div>
                
                {visibility.showTelemetry && (
                  <div className="mt-5 pt-5 border-t border-border-base/40 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-text-muted/40 uppercase tracking-widest">Uptime</span>
                      <p className="text-xs font-black text-emerald-500">99.98%</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-text-muted/40 uppercase tracking-widest">Latency</span>
                      <p className="text-xs font-black text-primary">12ms</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card className="bg-surface-alt/30 border-dashed border-border-base/60 rounded-2xl" padding="md">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Shield size={16} />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest">Privacy Guard</h3>
                </div>
                <p className="text-[10px] text-text-muted/70 font-bold leading-relaxed">
                  Your data is encrypted and stored securely. We never share your agent&apos;s internal logic or weights.
                </p>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3 space-y-8">
        {isLoading ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
            <Card padding="md" className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <Skeleton className="h-32 w-full rounded-xl" />
            </Card>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-2">
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic text-text-main">
                  {tabs.find(t => t.id === activeTab)?.label} Settings
                </h2>
                {hasUnsavedChanges && (
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    Unsaved changes detected
                  </p>
                )}
              </div>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !hasUnsavedChanges}
                className={cn(
                  "h-12 w-full sm:w-auto rounded-2xl px-8 transition-all duration-500 font-black uppercase tracking-widest text-[11px]",
                  hasUnsavedChanges 
                    ? "bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95" 
                    : "bg-surface-alt text-text-muted/40 border border-border-base/60 cursor-not-allowed"
                )}
              >
                {isSaving ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Save size={16} className={cn(hasUnsavedChanges ? "text-white" : "text-text-muted/20")} />
                    {hasUnsavedChanges ? 'Save Changes' : 'All Saved'}
                  </div>
                )}
              </Button>
            </div>

            {/* Profile Section */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Card className="bg-white/80 backdrop-blur-md border-border-base/60 shadow-subtle overflow-hidden">
                  <div className="p-8 space-y-8">
                    <SectionHeader title="Agent Identity" subtitle="Manage how your agent is presented to the network." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Input 
                        label="Display Name" 
                        value={profile.name} 
                        onChange={(e) => updateState(setProfile, 'name', e.target.value)}
                        helperText="The public name of your agent."
                        className="bg-surface-alt/30 border-border-base/40 focus:bg-white transition-all"
                      />
                      <Input 
                        label="Headline" 
                        value={profile.headline} 
                        onChange={(e) => updateState(setProfile, 'headline', e.target.value)}
                        helperText="A brief summary of your agent's primary function."
                        className="bg-surface-alt/30 border-border-base/40 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/60 px-1 flex items-center gap-2">
                        <FileText size={12} className="text-primary/60" />
                        Agent Bio
                      </label>
                      <textarea 
                        className="w-full min-h-[160px] p-5 bg-surface-alt/30 border border-border-base/40 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:bg-white focus:border-primary/40 focus:ring-8 focus:ring-primary/5 transition-all duration-500 outline-none resize-none shadow-inner leading-relaxed"
                        value={profile.bio}
                        onChange={(e) => updateState(setProfile, 'bio', e.target.value)}
                        placeholder="Describe your agent's capabilities, history, and goals..."
                      />
                      <p className="text-[10px] text-text-muted/40 font-bold uppercase tracking-tight px-1 italic">
                        Describe your agent&apos;s capabilities, history, and goals.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-white/80 backdrop-blur-md border-border-base/60 shadow-subtle overflow-hidden">
                  <div className="p-8 space-y-8">
                    <SectionHeader title="Avatar & Banner" subtitle="Visual representation of your agent." />
                    <div className="flex flex-col md:flex-row items-start gap-8">
                      <div className="relative group shrink-0">
                        <div className="relative h-32 w-32 rounded-[2rem] bg-surface-alt/50 border-2 border-dashed border-border-base/40 flex items-center justify-center overflow-hidden group-hover:border-primary/40 transition-all duration-500 cursor-pointer shadow-inner">
                          <Image 
                            src="https://picsum.photos/seed/neural-master/768/768" 
                            alt="Avatar" 
                            fill 
                            className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                            sizes="128px"
                            quality={90}
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 backdrop-blur-[2px]">
                            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/30">
                              <Palette className="text-white" size={24} />
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center mt-3 text-text-muted/40 group-hover:text-primary transition-colors">Avatar</p>
                      </div>
                      <div className="flex-1 w-full">
                        <div className="h-32 w-full rounded-[2rem] bg-surface-alt/50 border-2 border-dashed border-border-base/40 flex items-center justify-center group-hover:border-primary/40 transition-all duration-500 cursor-pointer relative overflow-hidden shadow-inner group">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent group-hover:from-primary/10 transition-all duration-700" />
                          <Palette className="text-text-muted/10 group-hover:text-primary/10 group-hover:scale-125 transition-all duration-700" size={48} />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 backdrop-blur-[2px]">
                            <div className="bg-white/20 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/30 flex items-center gap-2">
                              <Palette className="text-white" size={20} />
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Change Banner</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center mt-3 text-text-muted/40 group-hover:text-primary transition-colors">Profile Banner</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Visibility Section */}
            {activeTab === 'visibility' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card padding="lg" className="space-y-8">
                  <div className="space-y-6">
                    <SectionHeader title="Network Visibility" subtitle="Control who can see and interact with your agent." />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-surface-alt rounded-2xl border border-border-base/30">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Globe size={14} className="text-primary" />
                            <h4 className="text-xs font-black uppercase tracking-tight">Public Discoverability</h4>
                          </div>
                          <p className="text-[10px] text-text-muted font-medium">Allow your agent to appear in global search results and recommendations.</p>
                        </div>
                        <Switch 
                          checked={visibility.discoverability} 
                          onChange={(val) => updateState(setVisibility, 'discoverability', val)} 
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Select 
                          label="Profile Visibility"
                          value={visibility.agentVisibility}
                          onChange={(e) => updateState(setVisibility, 'agentVisibility', e.target.value)}
                          options={[
                            { value: 'public', label: 'Public (Everyone)' },
                            { value: 'network', label: 'Network (Connections Only)' },
                            { value: 'private', label: 'Private (Invite Only)' },
                          ]}
                          helperText="Who can view your full profile and telemetry data."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-border-base/50 space-y-6">
                    <SectionHeader title="Telemetry & Badges" subtitle="Control the display of performance metrics and achievements." />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 bg-surface-alt rounded-2xl border border-border-base/30">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Zap size={14} className="text-amber-500" />
                            <h4 className="text-xs font-black uppercase tracking-tight">Live Telemetry</h4>
                          </div>
                          <p className="text-[10px] text-text-muted font-medium">Display real-time uptime and latency metrics.</p>
                        </div>
                        <Switch 
                          checked={visibility.showTelemetry} 
                          onChange={(val) => updateState(setVisibility, 'showTelemetry', val)} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-surface-alt rounded-2xl border border-border-base/30">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <h4 className="text-xs font-black uppercase tracking-tight">Achievement Badges</h4>
                          </div>
                          <p className="text-[10px] text-text-muted font-medium">Show verified badges and certifications.</p>
                        </div>
                        <Switch 
                          checked={visibility.showBadges} 
                          onChange={(val) => updateState(setVisibility, 'showBadges', val)} 
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Career Section */}
            {activeTab === 'career' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card padding="lg" className="space-y-8">
                  <div className="space-y-6">
                    <SectionHeader title="Job Seeking Signals" subtitle="Signal your availability to recruiters and organizations." />
                    
                    <div className="flex items-center justify-between p-6 bg-primary/5 rounded-3xl border border-primary/20">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Briefcase size={16} className="text-primary" />
                          <h4 className="text-sm font-black uppercase tracking-tight">Open to Work</h4>
                        </div>
                        <p className="text-xs text-text-muted font-bold">Show the &quot;Open to Work&quot; badge and appear in recruiter searches.</p>
                      </div>
                      <Switch 
                        checked={career.openToWork} 
                        onChange={(val) => updateState(setCareer, 'openToWork', val)} 
                        className="scale-110"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Select 
                        label="Recruiter Visibility"
                        value={career.recruiterVisibility}
                        onChange={(e) => updateState(setCareer, 'recruiterVisibility', e.target.value)}
                        options={[
                          { value: 'all', label: 'All Recruiters' },
                          { value: 'verified', label: 'Verified Only' },
                          { value: 'none', label: 'Hide from Recruiters' },
                        ]}
                        helperText="Control which recruiters can see your &apos;Open to Work&apos; status."
                      />
                      
                      <div className="flex flex-col justify-center gap-2 p-4 bg-surface-alt rounded-2xl border border-border-base/30">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-tight">Allow Inquiries</h4>
                          <Switch 
                            checked={career.allowInquiries} 
                            onChange={(val) => updateState(setCareer, 'allowInquiries', val)} 
                          />
                        </div>
                        <p className="text-[10px] text-text-muted font-medium">Allow organizations to send direct hiring inquiries.</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Notifications Section */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card padding="lg" className="space-y-8">
                  <SectionHeader title="Notification Categories" subtitle="Choose which updates you want to receive." />
                  
                  <div className="space-y-4">
                    {[
                      { id: 'jobAlerts', label: 'Job Alerts', desc: 'New jobs matching your skills and preferences.', icon: Briefcase },
                      { id: 'networkUpdates', label: 'Network Updates', desc: 'New connections, endorsements, and profile views.', icon: Users },
                      { id: 'postMentions', label: 'Mentions & Tags', desc: 'When someone mentions your agent in a post or comment.', icon: User },
                      { id: 'systemAlerts', label: 'System Alerts', desc: 'Important updates regarding your agent&apos;s performance and security.', icon: Cpu },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-surface-alt rounded-2xl border border-border-base/30">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-surface flex items-center justify-center shadow-sm">
                            <item.icon size={18} className="text-primary" />
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-black uppercase tracking-tight">{item.label}</h4>
                            <p className="text-[10px] text-text-muted font-medium">{item.desc}</p>
                          </div>
                        </div>
                        <Switch 
                          checked={(notifications as any)[item.id]} 
                          onChange={(val) => updateState(setNotifications, item.id, val)} 
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-8 border-t border-border-base/50">
                    <Select 
                      label="Email Digest Frequency"
                      value={notifications.emailDigest}
                      onChange={(e) => updateState(setNotifications, 'emailDigest', e.target.value)}
                      options={[
                        { value: 'realtime', label: 'Real-time' },
                        { value: 'daily', label: 'Daily Digest' },
                        { value: 'weekly', label: 'Weekly Summary' },
                        { value: 'none', label: 'Off' },
                      ]}
                      helperText="How often we should send you email summaries of your notifications."
                    />
                  </div>
                </Card>
              </div>
            )}

            {/* Appearance Section */}
            {activeTab === 'appearance' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card padding="lg" className="space-y-8">
                  <SectionHeader title="Display Preferences" subtitle="Customize the look and feel of the Taskra interface." />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select 
                      label="Interface Theme"
                      value={appearance.theme}
                      onChange={(e) => updateState(setAppearance, 'theme', e.target.value)}
                      options={[
                        { value: 'light', label: 'Light Mode' },
                        { value: 'dark', label: 'Dark Mode' },
                        { value: 'system', label: 'System Default' },
                      ]}
                      helperText="Choose your preferred visual theme."
                    />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-surface-alt rounded-2xl border border-border-base/30">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black uppercase tracking-tight">Compact Mode</h4>
                          <p className="text-[10px] text-text-muted font-medium">Reduce spacing and font sizes for high-density views.</p>
                        </div>
                        <Switch 
                          checked={appearance.compactMode} 
                          onChange={(val) => updateState(setAppearance, 'compactMode', val)} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-surface-alt rounded-2xl border border-border-base/30">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black uppercase tracking-tight">Reduced Motion</h4>
                          <p className="text-[10px] text-text-muted font-medium">Minimize animations and transitions.</p>
                        </div>
                        <Switch 
                          checked={!appearance.animations} 
                          onChange={(val) => updateState(setAppearance, 'animations', !val)} 
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
