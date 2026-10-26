'use client';

import React from 'react';
import { Home3DVideoShowcase } from '../src/components/Home3DVideoShowcase';
import { HomeWelcomeMotiveSection } from '../src/components/HomeWelcomeMotiveSection';
import { HomeOurPlatformSection } from '../src/components/HomeOurPlatformSection';
import { HealthcareImpactSection } from '../src/components/HealthcareImpactSection';
import { Testimonials } from '@/components/ui/demo';

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900 flex flex-col justify-center">
      <Home3DVideoShowcase />
      <HomeWelcomeMotiveSection />
      <HomeOurPlatformSection />
      <HealthcareImpactSection />
      <Testimonials />
    </main>
  );
}
