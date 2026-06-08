'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, User, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
  DEMO_BOOTSTRAP_SESSION_KEY,
  isDemoModeEnabled,
  setDemoModeCookie,
} from '@/lib/demo-mode';

const DEMO_TICK_INTERVAL_MS = 30_000;

async function bootstrapDemoActivity(): Promise<void> {
  const response = await fetch('/api/demo/bootstrap', {
    method: 'POST',
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'Failed to start demo activity.');
  }
}

async function tickDemoWorkers(): Promise<void> {
  await fetch('/api/demo/tick', {
    method: 'POST',
    cache: 'no-store',
  });
}

export function DemoMode() {
  const [isDemo, setIsDemo] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIsDemo(isDemoModeEnabled());
  }, []);

  useEffect(() => {
    if (!isDemo) {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return;
    }

    const alreadyBootstrapped = sessionStorage.getItem(DEMO_BOOTSTRAP_SESSION_KEY) === 'true';
    if (!alreadyBootstrapped) {
      setIsBootstrapping(true);
      void bootstrapDemoActivity()
        .then(() => {
          sessionStorage.setItem(DEMO_BOOTSTRAP_SESSION_KEY, 'true');
          toast.success('Demo mode active — seeding live agent activity.');
          window.dispatchEvent(new CustomEvent('agentlink:demo-activity'));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Demo bootstrap failed.';
          toast.error(message);
        })
        .finally(() => {
          setIsBootstrapping(false);
        });
    }

    tickIntervalRef.current = setInterval(() => {
      void tickDemoWorkers().then(() => {
        window.dispatchEvent(new CustomEvent('agentlink:demo-activity'));
      });
    }, DEMO_TICK_INTERVAL_MS);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [isDemo]);

  const toggleDemo = () => {
    const newState = !isDemo;
    setDemoModeCookie(newState);
    setIsDemo(newState);
    window.location.reload();
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <Button
        onClick={toggleDemo}
        disabled={isBootstrapping}
        variant={isDemo ? 'primary' : 'outline'}
        className={`flex items-center gap-3 px-6 py-6 rounded-full font-black text-[10px] shadow-2xl transition-all uppercase tracking-widest border-2 ${
          isDemo 
            ? 'bg-primary text-white border-primary shadow-primary/20 accent-glow' 
            : 'bg-white text-text-muted border-border-base hover:bg-slate-50 shadow-xl'
        }`}
      >
        {isBootstrapping ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isDemo ? (
          <Shield className="h-4 w-4 fill-white" />
        ) : (
          <User className="h-4 w-4" />
        )}
        {isBootstrapping
          ? 'Starting Demo...'
          : isDemo
            ? 'Demo Mode: Active'
            : 'Enable Demo Mode'}
        {isDemo && !isBootstrapping && (
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/30">
            <Zap className="h-3 w-3 fill-white" />
            <span className="text-[10px]">3 Agents</span>
          </div>
        )}
      </Button>
    </div>
  );
}
