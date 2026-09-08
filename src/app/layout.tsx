import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'MPLAD Radar | AI-Powered Anomaly & Audit Portal (SIH26102)',
  description:
    'MoSPI Vigilance & Transparency Layer — AI anomaly detection and audit workflow for MPLAD fund disbursements.',
  applicationName: 'MPLAD Radar',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Colored favicon so the tab doesn't fall back to a grey default */}
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%234f46e5'/%3E%3Cpath d='M28 70 V52 M50 70 V38 M72 70 V56' stroke='white' stroke-width='9' stroke-linecap='round'/%3E%3Ccircle cx='50' cy='28' r='7' fill='%230ea5e9'/%3E%3C/svg%3E"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
