'use client';

import React from 'react';
import { Hero } from '../src/features/carousel/Hero';
import { MEDVEDA_FEATURE_CARDS } from '../src/features/carousel/media';
import { Testimonials } from '@/components/ui/demo';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FCFCFB] text-slate-900 flex flex-col justify-center">
      <Hero cards={MEDVEDA_FEATURE_CARDS} showCookieBanner={true} />
      <Testimonials />
    </main>
  );
}
