export const EASE = [0.22, 1, 0.36, 1];
export const EASE_SPRING = [0.34, 1.56, 0.64, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: EASE } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE } },
};

export const slideInLeft = {
  hidden: { opacity: 0, x: -22 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
};

export const slideInRight = {
  hidden: { opacity: 0, x: 22 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
};

export const pageTransition = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.22, ease: 'easeIn' } },
};

export const staggerContainer = (stagger = 0.07, delayChildren = 0.04) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

export const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export const listContainer = (stagger = 0.035) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});

export const listRow = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

export const hoverLift = {
  rest: { y: 0, scale: 1 },
  hover: { y: -5, scale: 1.006, transition: { duration: 0.3, ease: EASE } },
  tap: { y: -1, scale: 0.996, transition: { duration: 0.12 } },
};

export const viewportOnce = { once: true, margin: '-60px' };
