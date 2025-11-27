import type { Variants, Transition } from 'motion/react';

// Fade in from bottom
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Fade in from top
export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
};

// Fade in from left
export const fadeInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
};

// Fade in from right
export const fadeInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
};

// Simple fade
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

// Scale up
export const scaleUp: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

// Stagger container for children animations
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

// Fast stagger for lists
export const fastStagger: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Default transition
export const defaultTransition: Transition = {
  duration: 0.5,
  ease: [0.25, 0.1, 0.25, 1],
};

// Spring transition for interactive elements
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

// Hover scale for cards/buttons
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: springTransition,
};

// Hover lift for cards
export const hoverLift = {
  whileHover: { y: -4 },
  transition: { duration: 0.2 },
};

// Page transition variants
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
    },
  },
};
