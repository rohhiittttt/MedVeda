"use client";
import React from "react";
import { motion } from "motion/react";

export interface TestimonialItem {
  text: string;
  image: string;
  name: string;
  role: string;
}

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: TestimonialItem[];
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.div
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 bg-transparent"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, image, name, role }, i) => (
                <div
                  className="p-8 sm:p-10 rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/5 hover:shadow-xl hover:border-blue-200 transition-all duration-300 max-w-xs w-full select-none"
                  key={i}
                >
                  <div className="text-slate-700 text-sm leading-relaxed font-normal">
                    &ldquo;{text}&rdquo;
                  </div>
                  <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100">
                    <img
                      width={40}
                      height={40}
                      src={image}
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                      loading="lazy"
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="font-semibold tracking-tight text-slate-900 text-sm truncate">
                        {name}
                      </div>
                      <div className="text-xs text-slate-500 font-medium tracking-tight truncate">
                        {role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.div>
    </div>
  );
};
