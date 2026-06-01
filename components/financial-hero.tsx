"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FinancialHeroProps {
  title: React.ReactNode;
  description: string;
  buttonText: string;
  buttonLink: string;
  imageUrl1: string;
  imageUrl2: string;
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

const cardsVariants: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.8,
      ease: "easeOut",
      staggerChildren: 0.3,
    },
  },
};

const cardItemVariants: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0 },
};

export function FinancialHero({
  title,
  description,
  buttonText,
  buttonLink,
  imageUrl1,
  imageUrl2,
  className,
}: FinancialHeroProps) {
  const isExternalLink = /^https?:\/\//.test(buttonLink);
  const gridBackgroundStyle = {
    backgroundImage:
      "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)",
    backgroundSize: "3rem 3rem",
  };

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden bg-background text-foreground",
        className
      )}
    >
      <div className="absolute inset-0 opacity-60" style={gridBackgroundStyle} />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/85 to-background" />

      <motion.div
        className="relative mx-auto flex min-h-[80vh] max-w-7xl flex-col items-center justify-between gap-12 px-6 py-20 lg:flex-row"
        initial={false}
        animate="visible"
        variants={containerVariants}
      >
        <div className="flex flex-col items-center text-center lg:w-1/2 lg:items-start lg:text-left">
          <motion.h1
            className="text-4xl font-bold tracking-normal md:text-5xl lg:text-6xl"
            variants={itemVariants}
          >
            {title}
          </motion.h1>
          <motion.p
            className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground"
            variants={itemVariants}
          >
            {description}
          </motion.p>
          <motion.div variants={itemVariants} className="mt-8">
            <Button asChild size="lg">
              <a
                href={buttonLink}
                target={isExternalLink ? "_blank" : undefined}
                rel={isExternalLink ? "noopener noreferrer" : undefined}
              >
                {buttonText}
                <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
              </a>
            </Button>
          </motion.div>
        </div>

        <motion.div
          className="relative flex min-h-[24rem] w-full items-center justify-center lg:w-1/2"
          variants={cardsVariants}
        >
          <motion.img
            src={imageUrl2}
            alt="SeeV validation insight card"
            variants={cardItemVariants}
            whileHover={{ y: -10, rotate: -5, transition: { duration: 0.3 } }}
            className="absolute h-56 translate-x-16 rotate-[-6deg] rounded-2xl object-cover shadow-2xl md:h-80 md:translate-x-24"
          />
          <motion.img
            src={imageUrl1}
            alt="SeeV evaluation dashboard card"
            variants={cardItemVariants}
            whileHover={{ y: -10, rotate: 5, transition: { duration: 0.3 } }}
            className="absolute h-56 -translate-x-12 rotate-[6deg] rounded-2xl object-cover shadow-2xl md:h-80 md:-translate-x-16"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
