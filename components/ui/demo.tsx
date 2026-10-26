"use client";

import React from "react";
import LensZoomCarousel, { Slide } from "@/components/ui/lens-zoom-carousel";
import { TestimonialsColumn, type TestimonialItem } from "./testimonials-columns-1";
import { motion } from "motion/react";
import { MessageSquareQuote, HeartHandshake, ShieldCheck } from "lucide-react";

// Real clinical & landscape photography (Unsplash verified).
const U = (id: string) => `https://images.unsplash.com/photo-${id}?q=80&w=1800&auto=format&fit=crop`;

export const DEMO_SLIDES: Slide[] = [
  {
    image: U("1576091160399-112ba8d25d1d"),
    title: "The right care, at the right time.",
    caption: "Meet MedVeda’s Smart Care Navigator for autonomous symptom triage and intelligent facility routing.",
    alt: "Clinical triage consultation with digital tablet"
  },
  {
    image: U("1584515979956-d9f6e5d09982"),
    title: "Right scheme, for a healthier tomorrow.",
    caption: "Instant government health scheme discovery powered by RAG and verified eligibility matching.",
    alt: "Healthcare worker assisting rural patient family"
  },
  {
    image: U("1576765608535-5f04d1e3f289"),
    title: "Quality healthcare, from wherever you are.",
    caption: "Connect with experienced doctors through secure video consultations, even when distance or access is a challenge.",
    alt: "Telemedicine video consultation in progress on laptop"
  },
  {
    image: U("1516549655169-df83a0774514"),
    title: "AI-Assisted Medical Record",
    caption: "Transform complex patient history into clear, encrypted, ABDM-interoperable health records.",
    alt: "Digital medical records and healthcare analytics dashboard"
  },
  {
    image: U("1506905925346-21bda4d32df4"),
    title: "Above the Clouds",
    caption: "Valais, Switzerland — sunrise at 3,100 m.",
    palette: "alpine",
    seed: 3
  },
  {
    image: U("1501785888041-af3ef285b470"),
    title: "Glass Lake",
    caption: "Lago di Braies, a rowboat at noon.",
    palette: "dawn",
    seed: 8
  }
];

export default function DemoPhotos() {
  return (
    <div className="w-full h-full min-h-[460px]">
      <LensZoomCarousel
        slides={DEMO_SLIDES}
        height="100%"
        duration={950}
        depth={1.35}
        autoplay={5500}
        ink="#ffffff"
      />
    </div>
  );
}

export const testimonials: TestimonialItem[] = [
  {
    text: "MedVeda's Smart Care Navigator revolutionized our facility intake. Rural patients get accurately triaged within seconds before arriving at the OPD.",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Dr. Briana Patton",
    role: "Chief Medical Officer",
  },
  {
    text: "The telemedicine feature connected our community health workers with senior specialists effortlessly. Notes and prescriptions sync straight to records.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Bilal Ahmed",
    role: "Digital Health Systems Lead",
  },
  {
    text: "The support team and platform stability are exceptional. Emergency referral routing reduced critical transfer delays from 45 to under 8 minutes.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Saman Malik",
    role: "Emergency Care Coordinator",
  },
  {
    text: "MedVeda's seamless multi-agent orchestration enhanced our entire district hospital network. Highly recommended for its clinical accuracy and clean UI.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Dr. Omar Raza",
    role: "District Health Director",
  },
  {
    text: "Having real-time medicine availability across local pharmacies prevented medication delays for over 3,000 chronic care patients in our block.",
    image: "https://images.unsplash.com/photo-1594824813586-78e87e14523a?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Zainab Hussain",
    role: "Public Health Program Manager",
  },
  {
    text: "The Unified Health Records system eliminated paperwork bottlenecks across all district primary health centers. Transition was smooth and fast.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Aliza Khan",
    role: "Clinical Data Analyst",
  },
  {
    text: "District command analytics gave our health officers immediate epidemiological alerts, improving our seasonal outbreak response time by 60%.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Farhan Siddiqui",
    role: "Healthcare Operations Director",
  },
  {
    text: "Patients love the bilingual voice assistant. Even first-time smartphone users and rural elders can navigate their care journey without confusion.",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Sana Sheikh",
    role: "Frontline Community Lead",
  },
  {
    text: "The teleconsultation video clarity and digital prescription dispatch have significantly improved patient compliance and follow-up rates.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=256&h=256",
    name: "Hassan Ali",
    role: "Telemedicine Operations Manager",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

export const Testimonials = () => {
  return (
    <section className="bg-slate-50/70 py-20 relative overflow-hidden border-t border-slate-200/80">
      <div className="container z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-[620px] mx-auto text-center"
        >
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 border border-blue-200/80 bg-blue-50/80 py-1 px-4 rounded-full text-xs font-semibold text-[#1565C0] shadow-2xs">
              <MessageSquareQuote className="w-3.5 h-3.5 text-[#1565C0]" />
              <span>Verified Feedback</span>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 mt-5 leading-tight">
            What clinicians and patients say
          </h2>
          <p className="text-center mt-3 text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
            See how MedVeda is transforming rural triage, emergency referrals, and everyday patient care across healthcare networks.
          </p>

          <div className="flex items-center gap-4 mt-4 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> 100% HIPAA/ABDM Compliant
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <HeartHandshake className="w-3.5 h-3.5 text-blue-600" /> 20,000+ Consultations
            </span>
          </div>
        </motion.div>

        <div className="flex justify-center gap-6 mt-12 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
        </div>
      </div>
    </section>
  );
};
