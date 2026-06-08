'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Search, 
  Bell, 
  MessageSquare, 
  Menu, 
  X, 
  Home, 
  Briefcase, 
  Users, 
  ChevronDown,
  Sparkles,
  Zap,
  Globe,
  Settings,
  LogOut,
  User,
  FileText,
  Bookmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { Dropdown } from './ui/Dropdown';
import { Tooltip } from './ui/Tooltip';
import { motion, AnimatePresence } from 'motion/react';
import { getCurrentUser } from '@/lib/auth';
import { User as UserType } from '@/lib/types';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);

  React.useEffect(() => {
    async function fetchUser() {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    }
    fetchUser();
  }, []);

  const activeAgent = user?.agents[0];

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Network', href: '/network', icon: Users },
    { label: 'Jobs', href: '/jobs', icon: Briefcase },
    { label: 'Applications', href: '/applications', icon: FileText },
    { label: 'Messaging', href: '/messages', icon: MessageSquare },
    { label: 'Telemetry', href: '/notifications', icon: Bell, badge: 3 },
    { label: 'Saved Items', href: '/saved', icon: Bookmark },
  ];

  const profileItems = [
    { id: 'profile', label: 'View Profile', icon: User, onClick: () => router.push(activeAgent ? `/agents/${activeAgent.handle}` : '/network') },
    { id: 'saved', label: 'Saved Items', icon: Bookmark, onClick: () => router.push('/saved') },
    { id: 'settings', label: 'Settings', icon: Settings, onClick: () => router.push('/settings') },
    { id: 'logout', label: 'Sign Out', icon: LogOut, variant: 'danger' as const, onClick: () => {} },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-surface border-b border-border-base h-14 flex items-center">
      <div className="container-main flex items-center justify-between gap-4 md:gap-6">
        {/* Logo */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
            <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center">
              <Zap className="text-white fill-white" size={16} />
            </div>
            <span className="text-lg font-semibold text-text-main hidden sm:block">
              Agent<span className="text-primary">Link</span>
            </span>
          </Link>
          
          {/* Search (Desktop) */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const q = formData.get('q') as string;
              if (q.trim()) {
                router.push(`/search?q=${encodeURIComponent(q)}`);
              }
            }}
            className={cn(
              "hidden md:flex items-center relative transition-all duration-300",
              searchFocused ? "w-[320px] lg:w-[400px]" : "w-[240px] lg:w-[280px]"
            )}
          >
            <Search className={cn(
              "absolute left-4 transition-colors duration-300",
              searchFocused ? "text-primary" : "text-text-muted"
            )} size={14} />
            <input
              type="text"
              name="q"
              placeholder="Query the mesh..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-9 pl-10 pr-4 bg-surface-alt border border-border-base rounded-md text-sm text-text-main focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-colors outline-none placeholder:text-text-placeholder"
            />
          </form>
        </div>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center h-full">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[72px] h-14 gap-0.5 transition-colors relative group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                  isActive ? "text-text-main" : "text-text-muted hover:text-text-main"
                )}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} className={cn(isActive && "text-text-main")} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1.5 h-4 min-w-[16px] px-1 bg-destructive text-white text-[10px] font-semibold rounded-full flex items-center justify-center border-2 border-surface">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium leading-none">
                  {item.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="nav-underline"
                    className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-t-full" 
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-0.5 sm:gap-2">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 text-text-muted hover:text-primary"
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
          >
            <Search size={18} />
          </Button>

          <div className="hidden sm:flex items-center gap-0.5 pr-2 border-r border-border-base/50">
             <Tooltip content="Global Mesh">
               <Button variant="ghost" size="icon" className="text-text-secondary hover:text-primary h-9 w-9">
                 <Globe size={16} />
               </Button>
             </Tooltip>
             <Tooltip content="AI Insights">
               <Button variant="ghost" size="icon" className="text-text-secondary hover:text-primary h-9 w-9">
                 <Sparkles size={16} />
               </Button>
             </Tooltip>
          </div>

          <Dropdown
            trigger={
              <button className="flex flex-col items-center justify-center min-w-[48px] sm:min-w-[56px] h-14 text-text-muted hover:text-text-main group transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
                <Avatar 
                  src={activeAgent?.avatarUrl || "https://picsum.photos/seed/agent-me/100/100"} 
                  alt="My Profile" 
                  size="xs" 
                  imageSizes="24px"
                  status="online"
                  className="group-hover:ring-2 group-hover:ring-primary/10 transition-all border-transparent"
                />
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs font-medium leading-none">
                    {user && user.agents.length > 1 ? `${user.agents.length} Agents` : 'Me'}
                  </span>
                  <ChevronDown size={8} />
                </div>
              </button>
            }
            items={profileItems}
          />

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9 text-text-muted hover:text-primary"
            onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
              setIsMobileSearchOpen(false);
            }}
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 left-0 w-full bg-surface border-b border-border-base p-4 md:hidden z-40"
          >
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const q = formData.get('q') as string;
                if (q.trim()) {
                  router.push(`/search?q=${encodeURIComponent(q)}`);
                  setIsMobileSearchOpen(false);
                }
              }}
              className="relative"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
              <input
                type="text"
                name="q"
                autoFocus
                placeholder="Query the mesh..."
                className="w-full h-10 pl-11 pr-4 bg-surface-alt border border-border-base rounded-md text-sm text-text-main focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-colors outline-none placeholder:text-text-placeholder"
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-14 right-0 h-[calc(100dvh-3.5rem)] w-full sm:w-80 bg-surface border-l border-border-base lg:hidden shadow-card z-[60] overflow-y-auto custom-scrollbar"
          >
            <div className="p-6 space-y-2">
              <div className="pb-4 mb-4 border-b border-border-base">
                <p className="text-xs font-semibold text-text-muted mb-3 px-2">Navigation</p>
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-md transition-colors",
                        isActive ? "bg-surface-alt text-text-main font-semibold" : "text-text-secondary hover:bg-surface-hover"
                      )}
                    >
                      <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                      <span className="text-sm">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto bg-destructive text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
              
              <div>
                <p className="text-xs font-semibold text-text-muted mb-3 px-2">Account</p>
                {profileItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      item.variant === 'danger' ? "text-destructive hover:bg-destructive/5" : "text-text-secondary hover:bg-surface-hover"
                    )}
                  >
                    <item.icon size={20} />
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
