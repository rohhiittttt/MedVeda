import React from 'react';

export const metadata = {
  title: 'MedVeda - Autonomous Cognitive Health Network',
  description: 'Smart Care Navigator & Clinical Intelligence Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
