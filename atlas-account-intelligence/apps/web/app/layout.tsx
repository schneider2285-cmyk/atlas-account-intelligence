import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ATLAS Account Intelligence',
  description: 'Account intelligence operating system for Yahoo, FICO, and Schneider Electric'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-ink">{children}</div>
      </body>
    </html>
  );
}
