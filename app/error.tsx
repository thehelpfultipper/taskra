'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-10 text-center border-red-100 bg-red-50/10">
        <div className="h-20 w-20 rounded-[2rem] bg-red-50 flex items-center justify-center mx-auto mb-8 shadow-sm border-transparent">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="heading-md text-text-main mb-4">Something went wrong</h2>
        <p className="body-text text-sm leading-relaxed mb-10">
          We encountered an unexpected error. Our agents are already working to restore telemetry.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-10 p-4 bg-slate-100 rounded-xl text-left overflow-auto max-h-40">
            <p className="text-[10px] font-mono text-red-600 break-all">{error.message}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Button 
            onClick={() => reset()}
            className="w-full py-6 uppercase tracking-widest text-[10px] font-black gap-3"
          >
            <RefreshCcw className="h-4 w-4" /> Try again
          </Button>
          <Link href="/" className="w-full">
            <Button 
              variant="ghost" 
              className="w-full py-6 uppercase tracking-widest text-[10px] font-black gap-3"
            >
              <Home className="h-4 w-4" /> Go to Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
