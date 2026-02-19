/**
 * FeatureCardsSection.tsx
 * ───────────────────────
 * Three feature cards displayed in a responsive grid below the hero CTA.
 * Subtle grid texture background, hover-lift animation, green accent.
 */

import { motion } from "framer-motion";
import { Network, ScanSearch, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Network,
    title: "Graph Analysis",
    description:
      "Map complex transaction networks to reveal hidden relationships and fraud rings.",
  },
  {
    icon: ScanSearch,
    title: "Pattern Detection",
    description:
      "Identify suspicious patterns using advanced graph algorithms and heuristics.",
  },
  {
    icon: ShieldCheck,
    title: "Risk Scoring",
    description:
      "Quantify risk with multi-dimensional scoring across transaction clusters.",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.12 * i, duration: 0.5, ease: "easeOut" },
  }),
};

const FeatureCardsSection = () => (
  <section className="relative overflow-hidden pt-0 pb-16 sm:pb-20">
    {/* Grid texture removed — the interactive graph bg provides texture */}

    <div className="container relative z-10 mx-auto max-w-5xl px-6">
      {/* ── Section heading ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          How it works
        </h2>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground">
          TraceLedger combines graph theory with financial forensics to surface fraud that
          traditional rule-based systems miss.
        </p>
      </motion.div>

      {/* ── Cards grid ──────────────────────────────────── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={cardVariants}
            /* Focus ring for a11y */
            tabIndex={0}
            className="group relative rounded-xl border border-border bg-card p-6 shadow-sm outline-none ring-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2"
          >
            {/* Icon */}
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent transition-colors duration-300 group-hover:bg-primary/10">
              <f.icon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
            </div>

            {/* Title */}
            <h3 className="mb-2 text-base font-semibold text-foreground">{f.title}</h3>

            {/* Description */}
            <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>

            {/* Hover accent bar */}
            <span className="absolute bottom-0 left-6 right-6 h-0.5 origin-left scale-x-0 rounded-full bg-primary transition-transform duration-300 group-hover:scale-x-100" />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeatureCardsSection;
