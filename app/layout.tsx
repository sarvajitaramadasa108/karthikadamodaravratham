import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Karthika Damodara Vratham | Vizag',
  description: 'A 30-day month of offering Love and Devotion. A free devotional challenge for children ages 6–15 in and around Vizag. October 26–November 24, 2026.',
  icons: { icon: '/favicon.svg' }
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
