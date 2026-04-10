import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Apollo Africa — Energy Proposal',
  description:
    'Securing Renewable Energy Supply. Green Energy | Expertly Sourced | Seamlessly Delivered.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-charcoal">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow+Semi+Condensed:wght@600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-charcoal text-offwhite antialiased">
        {children}
      </body>
    </html>
  );
}
