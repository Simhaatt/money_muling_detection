import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { uploadFile } from "@/services/api";

const stages = [
  "Uploading transaction file...",
  "Parsing transaction records...",
  "Constructing transaction graph...",
  "Detecting community structures...",
  "Analyzing fraud ring patterns...",
  "Calculating risk scores...",
  "Generating report...",
];

const ProcessingPage = () => {
  const navigate = useNavigate();
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Prevent double-run in strict mode
    if (startedRef.current) return;
    startedRef.current = true;

    const file = (window as any).__pendingUploadFile as File | undefined;
    if (!file) {
      // No file pending — check if results already exist
      if (sessionStorage.getItem("analysisResults")) {
        navigate("/results");
      } else {
        navigate("/upload");
      }
      return;
    }

    // Clear the global reference
    delete (window as any).__pendingUploadFile;
    sessionStorage.removeItem("pendingFile");

    // Simulated progress that slows as it approaches 92%.
    // Jumps to 100% only when the real upload response arrives.
    let currentProgress = 0;
    let done = false;

    const ticker = setInterval(() => {
      if (done) return;
      const remaining = 92 - currentProgress;
      const increment = Math.max(0.15, remaining * 0.02);
      currentProgress = Math.min(92, currentProgress + increment);
      setProgress(currentProgress);
    }, 100);

    // Perform the real upload + detection pipeline
    uploadFile(file)
      .then((results) => {
        done = true;
        clearInterval(ticker);
        sessionStorage.setItem("analysisResults", JSON.stringify(results));
        setProgress(100);
        setTimeout(() => navigate("/results"), 400);
      })
      .catch((err) => {
        done = true;
        clearInterval(ticker);
        setError(err.message || "Analysis failed. Please try again.");
      });

    return () => clearInterval(ticker);
  }, [navigate]);

  // Map progress to stage index
  useEffect(() => {
    const idx = Math.min(
      Math.floor((progress / 100) * stages.length),
      stages.length - 1
    );
    setStageIndex(idx);
  }, [progress]);

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Analysis Failed</h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/upload")}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
      <div className="flex flex-col items-center">
        {/* Animated graph nodes */}
        <div className="relative mb-10 h-32 w-32">
          {/* Center node */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          {/* Orbiting nodes */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            const r = 50;
            return (
              <motion.div
                key={i}
                className="absolute h-3 w-3 rounded-full bg-primary/60"
                style={{
                  left: `calc(50% + ${Math.cos(angle) * r}px)`,
                  top: `calc(50% + ${Math.sin(angle) * r}px)`,
                  translateX: "-50%",
                  translateY: "-50%",
                }}
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.3,
                  repeat: Infinity,
                }}
              />
            );
          })}
          {/* Connecting lines */}
          <svg className="absolute inset-0 h-full w-full">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (i / 6) * Math.PI * 2;
              const r = 50;
              const cx = 64, cy = 64;
              return (
                <motion.line
                  key={i}
                  x1={cx}
                  y1={cy}
                  x2={cx + Math.cos(angle) * r}
                  y2={cy + Math.sin(angle) * r}
                  stroke="hsl(155, 100%, 33%)"
                  strokeWidth="1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                />
              );
            })}
          </svg>
        </div>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-2 text-lg font-semibold text-foreground"
        >
          Analyzing Transaction Graph
        </motion.h2>

        <p className="mb-8 text-sm text-muted-foreground">{stages[stageIndex]}</p>

        {/* Progress bar */}
        <div className="mb-4 h-1.5 w-64 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="gradient-primary h-full rounded-full"
            style={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ ease: "linear" }}
          />
        </div>

        <p className="text-xs text-muted-foreground">{Math.min(Math.round(progress), 100)}%</p>
      </div>
    </div>
  );
};

export default ProcessingPage;
