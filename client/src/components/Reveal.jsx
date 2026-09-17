import { motion } from 'framer-motion';
import { EASE, pageTransition } from '../lib/motion';

export function FadeIn({ children, delay = 0, y = 18, className, ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export function Stagger({ children, className, ...rest }) {
  return (
    <motion.div className={className} variants={staggerContainer} initial="hidden" animate="show" {...rest}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...rest }) {
  return (
    <motion.div className={className} variants={staggerItem} {...rest}>
      {children}
    </motion.div>
  );
}

export function PageTransition({ children }) {
  return (
    <motion.div initial={pageTransition.initial} animate={pageTransition.animate} exit={pageTransition.exit}>
      {children}
    </motion.div>
  );
}