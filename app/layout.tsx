import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Apollo Africa — Energy Proposal',
  description: 'Securing Renewable Energy Supply. Green Energy | Expertly Sourced | Seamlessly Delivered.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow+Semi+Condensed:wght@600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'DM Sans', sans-serif", background: '#0D1B14' }}>
        {children}
      </body>
    </html>
  );
}
