import './globals.css';
import { cookies } from 'next/headers';
import { TranslationProvider, Locale } from '../context/TranslationContext';
import TopNav from '../components/nav/TopNav';
import Footer from '../components/nav/Footer';
import { Inter, Sora, Space_Grotesk } from 'next/font/google';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
});

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata = {
  title: 'Imprinta - Premium Custom Prints & Framing',
  description: 'Enterprise Print-On-Demand store with real-time tracking and automated assignments.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'en') as Locale;
  const dir = locale === 'ar-eg' ? 'rtl' : 'ltr';
  const theme = cookieStore.get('theme')?.value || 'dark';

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${theme} ${inter.variable} ${sora.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="antialiased min-h-screen bg-background text-text transition-colors duration-300 flex flex-col justify-between font-sans">
        <TranslationProvider initialLocale={locale}>
          <div>
            {/* Global Floating Pill Navigation */}
            <TopNav />
            
            {/* Page Mount Point */}
            <main className="pt-24 pb-16 px-4 md:px-8 max-w-7xl mx-auto transition-all duration-300">
              {children}
            </main>
          </div>

          {/* Premium Footer */}
          <Footer />
        </TranslationProvider>
      </body>
    </html>
  );
}
