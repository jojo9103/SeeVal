"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroSectionProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  subtitle: string;
  primaryButtonText: string;
  primaryButtonHref: string;
  secondaryButtonText: string;
  secondaryButtonHref: string;
  imageUrl: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
};

const HeroSection = React.forwardRef<HTMLElement, HeroSectionProps>(
  (
    {
      className,
      title,
      subtitle,
      primaryButtonText,
      primaryButtonHref,
      secondaryButtonText,
      secondaryButtonHref,
      imageUrl,
      ...props
    },
    ref
  ) => {
    return (
      <section
        ref={ref}
        className={cn(
          "relative flex h-screen min-h-[700px] w-full items-center justify-center overflow-hidden px-6",
          className
        )}
        {...props}
      >
        <div
          className="absolute inset-0 z-[-1] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${imageUrl})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 z-0 bg-black/55" aria-hidden="true" />
        <div
          className="absolute inset-0 z-0 bg-radial-[circle_at_center] from-black/45 via-black/20 to-transparent"
          aria-hidden="true"
        />

        <motion.div
          className="z-10 flex max-w-4xl flex-col items-center justify-center text-center text-white"
          variants={containerVariants}
          initial={false}
          animate="visible"
        >
          <motion.h1
            className="text-4xl font-bold tracking-normal drop-shadow-[0_3px_18px_rgba(0,0,0,0.55)] sm:text-5xl md:text-6xl lg:text-7xl"
            variants={itemVariants}
          >
            {title}
          </motion.h1>

          <motion.p
            className="mt-6 max-w-2xl text-lg leading-8 text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] md:text-xl"
            variants={itemVariants}
          >
            {subtitle}
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-x-6"
            variants={itemVariants}
          >
            <Button asChild size="lg">
              <a href={primaryButtonHref}>{primaryButtonText}</a>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a href={secondaryButtonHref}>{secondaryButtonText}</a>
            </Button>
          </motion.div>
        </motion.div>
      </section>
    );
  }
);

HeroSection.displayName = "HeroSection";

export { HeroSection };
