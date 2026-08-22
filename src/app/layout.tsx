import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/context/AuthContext';
import { AppProvider } from '@/lib/context/AppContext';
import { AppShell } from '@/components/layout/AppShell';
import { ToastContainer } from '@/components/ui/Toast';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mardiono Home Service - Workshop Management System',
  description:
    'Sistem Manajemen Bengkel Mobil Modern: Intake SPK Digital, Checklist Inspeksi Mesin & AC, Estimasi Biaya, Kasir, Inventaris & CRM Service Reminder.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={montserrat.variable}>
      <body className={`${montserrat.className} bg-surface-50 text-slate-900 min-h-screen font-sans antialiased selection:bg-maroon-700 selection:text-white`}>
        <AuthProvider>
          <AppProvider>
            <AppShell>{children}</AppShell>
            {/* Toast Notification Container */}
            <ToastContainer />
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
