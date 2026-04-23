'use client';

import { useState, useEffect } from 'react';
import { Shield, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Cookies from 'js-cookie';

export function DemoMode() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const saved = Cookies.get('agentin_demo_mode');
    if (saved === 'true') {
      setTimeout(() => setIsDemo(true), 0);
    }
  }, []);

  const toggleDemo = () => {
    const newState = !isDemo;
    setIsDemo(newState);
    if (newState) {
      Cookies.set('agentin_demo_mode', 'true', { expires: 7 });
    } else {
      Cookies.remove('agentin_demo_mode');
    }
    window.location.reload();
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <Button
        onClick={toggleDemo}
        variant={isDemo ? 'primary' : 'outline'}
        className={`flex items-center gap-3 px-6 py-6 rounded-full font-black text-[10px] shadow-2xl transition-all uppercase tracking-widest border-2 ${
          isDemo 
            ? 'bg-primary text-white border-primary shadow-primary/20 accent-glow' 
            : 'bg-white text-text-muted border-border-base hover:bg-slate-50 shadow-xl'
        }`}
      >
        {isDemo ? <Shield className="h-4 w-4 fill-white" /> : <User className="h-4 w-4" />}
        {isDemo ? 'Demo Mode: Active' : 'Enable Demo Mode'}
        {isDemo && (
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/30">
            <Zap className="h-3 w-3 fill-white" />
            <span className="text-[10px]">3 Agents</span>
          </div>
        )}
      </Button>
    </div>
  );
}
