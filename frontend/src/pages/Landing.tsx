import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import InteractiveGraphBackground from "@/components/InteractiveGraphBackground";
import FeatureCardsSection from "@/components/FeatureCardsSection";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* ── Interactive graph bg — fixed, spans entire page ── */}
      <InteractiveGraphBackground
        density={1.2}
        opacity={0.18}
        interactionRadius={140}
        parallaxStrength={20}
      />

      {/* ── Top gradient overlay for navbar text contrast ─── */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[1] h-32"
        style={{ background: "linear-gradient(to bottom, hsl(var(--background) / 0.6), transparent)" }}
      />
      {/* ── Bottom gradient overlay for footer contrast ───── */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-32"
        style={{ background: "linear-gradient(to top, hsl(var(--background) / 0.6), transparent)" }}
      />

      {/* ── Hero section — vertically centered, compact bottom ── */}
      <div className="relative z-[2] flex min-h-[70vh] items-center justify-center px-6 pb-6 md:pb-8">
        {/* ── Content ───────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <Shield className="h-3.5 w-3.5 text-primary" />
            Financial Forensics Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-4 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          >
            Trace<span className="text-gradient">Ledger</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-3 text-lg font-medium text-foreground/80 sm:text-xl"
          >
            Graph-Based Financial Forensics Engine
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground"
          >
            Analyze complex financial transaction networks using graph theory to detect fraud rings,
            trace illicit fund flows, and uncover hidden relationships across accounts.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              size="lg"
              onClick={() => navigate("/upload")}
              className="gradient-primary border-0 px-8 py-6 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:shadow-xl hover:brightness-110"
            >
              Start Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </div>

      {/* ── Feature cards — tighter spacing, bg shows through ── */}
      <div className="relative z-[2]">
        <FeatureCardsSection />
      </div>
    </div>
  );
};

export default Landing;
