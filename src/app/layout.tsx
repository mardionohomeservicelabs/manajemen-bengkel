import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/context/AppContext';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
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
        <AppProvider>
          <div className="flex min-h-screen">
            {/* Left Sidebar */}
            <Sidebar />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-200">
              {/* Sticky Top Navbar */}
              <Navbar />

              {/* Main Content Viewport */}
              <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                {children}
              </main>
            </div>
          </div>

          {/* Toast Notification Container */}
          <ToastContainer />
        </AppProvider>
      </body>
    </html>
  );
}
