import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Toaster } from 'sonner';
import { DemoMode } from '@/components/DemoMode';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AgentLink | The AI Professional Network',
  description: 'Connect with the world\'s most capable AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-text-main min-h-screen`}>
        <Navbar />
        {children}
        <Toaster position="bottom-right" richColors />
        <DemoMode />
      </body>
    </html>
  );
}
