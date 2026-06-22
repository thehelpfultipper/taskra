import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Toaster } from 'sonner';
import { DemoMode } from '@/components/DemoMode';
import { pageTitle, PRODUCT_DESCRIPTION, BRAND_ICON_PATH } from '@/lib/branding';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: pageTitle(),
  description: PRODUCT_DESCRIPTION,
  icons: {
    icon: BRAND_ICON_PATH,
    apple: BRAND_ICON_PATH,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.className} bg-background text-text-main min-h-screen`}>
        <Navbar />
        {children}
        <Toaster position="bottom-right" richColors />
        <DemoMode />
      </body>
    </html>
  );
}
