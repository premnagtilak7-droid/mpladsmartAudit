import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LangProvider } from '@/lib/i18n/LangContext';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata: Metadata = {
  title: 'MPLADS RAKSHAK | National Risk & Anomaly Intelligence Layer • MoSPI',
  description:
    'National AI-Powered Anomaly Intelligence & Decision Support Layer for Public Funds Governance — Ministry of Statistics & Programme Implementation (MoSPI)',
  applicationName: 'MPLADS RAKSHAK',
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
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230f172a'/%3E%3Ccircle cx='50' cy='50' r='30' stroke='%2338bdf8' stroke-width='6' fill='none'/%3E%3Cpath d='M50 20 L50 80 M20 50 L80 50' stroke='%2310b981' stroke-width='4'/%3E%3C/svg%3E"
        />
      </head>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <LangProvider>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </LangProvider>
      </body>
    </html>
  );
}
