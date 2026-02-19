/**
 * InteractiveGraphBackground.tsx
 * ──────────────────────────────
 * A high-density, translucent node-link graph rendered via Canvas.
 * Reacts to mouse movement with parallax, node glow, and edge brightening.
 * Respects `prefers-reduced-motion` and stays GPU-friendly (transform/opacity only).
 *
 * Props:
 *   density       – node count multiplier (default 1)
 *   opacity       – base opacity for all elements (0–1, default 0.08)
 *   interactionRadius – px radius for hover glow (default 120)
 *   parallaxStrength  – max px shift on mouse move (default 18)
 */

import { useRef, useEffect, useCallback, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────
interface Props {
  density?: number;
  opacity?: number;
  interactionRadius?: number;
  parallaxStrength?: number;
}

interface Node {
  x: number;
  y: number;
  r: number;
  baseR: number;
  vx: number;
  vy: number;
  hub: boolean;
  pulse: number;      // 0→1 pulse phase (hub nodes only)
  pulseSpeed: number;
}

interface Edge {
  a: number;
  b: number;
}

// ── Deterministic PRNG ───────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Graph generation ─────────────────────────────────────────
function createGraph(w: number, h: number, density: number) {
  const rand = mulberry32(7749);
  // ~90 nodes at density=1 for a 1920×1080 viewport
  const count = Math.round(90 * density * Math.max(1, (w * h) / (1920 * 900)));
  const maxEdgeDist = Math.min(w, h) * 0.18;

  const nodes: Node[] = [];
  for (let i = 0; i < count; i++) {
    const baseR = 1.8 + rand() * 3.2;
    nodes.push({
      x: rand() * w,
      y: rand() * h,
      r: baseR,
      baseR,
      vx: (rand() - 0.5) * 0.12,
      vy: (rand() - 0.5) * 0.12,
      hub: rand() < 0.12,
      pulse: rand(),
      pulseSpeed: 0.003 + rand() * 0.004,
    });
  }

  const edges: Edge[] = [];
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < maxEdgeDist && rand() > 0.45) {
        edges.push({ a: i, b: j });
      }
    }
  }
  return { nodes, edges };
}

// ── Component ────────────────────────────────────────────────
const InteractiveGraphBackground = ({
  density = 1,
  opacity = 0.08,
  interactionRadius = 120,
  parallaxStrength = 18,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const offsetRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 }); // parallax offset
  const graphRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // Resize handler — rebuilds graph on dimension change
  const rebuild = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    graphRef.current = createGraph(rect.width, rect.height, density);
  }, [density]);

  // Throttled mousemove (updates ~60 fps via rAF reads)
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // Use clientX/Y directly since canvas is fixed at (0,0)
      mouseRef.current = { x: e.clientX, y: e.clientY };

      // Parallax target (normalized −1…1 from center)
      if (!reducedMotion) {
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        offsetRef.current.tx = nx * parallaxStrength;
        offsetRef.current.ty = ny * parallaxStrength;
      }
    },
    [parallaxStrength, reducedMotion]
  );

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -9999, y: -9999 };
    offsetRef.current.tx = 0;
    offsetRef.current.ty = 0;
  }, []);

  useEffect(() => {
    rebuild();
    window.addEventListener("resize", rebuild);
    return () => window.removeEventListener("resize", rebuild);
  }, [rebuild]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const g = graphRef.current;
      if (!g) { rafRef.current = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { nodes, edges } = g;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const iRad = interactionRadius;
      const iRadSq = iRad * iRad;

      // Smooth parallax interpolation
      const off = offsetRef.current;
      off.x += (off.tx - off.x) * 0.04;
      off.y += (off.ty - off.y) * 0.04;

      // ── Drift nodes (subtle idle motion) ───────────────────
      if (!reducedMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20) n.x = w + 20;
          if (n.x > w + 20) n.x = -20;
          if (n.y < -20) n.y = h + 20;
          if (n.y > h + 20) n.y = -20;
          // Hub pulse
          if (n.hub) {
            n.pulse = (n.pulse + n.pulseSpeed) % 1;
          }
        }
      }

      // ── Draw edges ─────────────────────────────────────────
      for (const e of edges) {
        const na = nodes[e.a];
        const nb = nodes[e.b];
        const ax = na.x + off.x;
        const ay = na.y + off.y;
        const bx = nb.x + off.x;
        const by = nb.y + off.y;

        // Mid-point proximity to cursor
        const emx = (ax + bx) * 0.5;
        const emy = (ay + by) * 0.5;
        const edx = emx - mx;
        const edy = emy - my;
        const edSq = edx * edx + edy * edy;
        const proximity = edSq < iRadSq ? 1 - Math.sqrt(edSq) / iRad : 0;

        const edgeAlpha = opacity * 0.8 + proximity * 0.25;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = proximity > 0
          ? `rgba(0, 168, 107, ${edgeAlpha})`   // green accent on hover
          : `rgba(148, 163, 184, ${opacity * 0.7})`; // slate-400
        ctx.lineWidth = 0.6 + proximity * 1.2;
        ctx.stroke();
      }

      // ── Draw nodes ─────────────────────────────────────────
      for (const n of nodes) {
        const nx = n.x + off.x;
        const ny = n.y + off.y;
        const dx = nx - mx;
        const dy = ny - my;
        const dSq = dx * dx + dy * dy;
        const proximity = dSq < iRadSq ? 1 - Math.sqrt(dSq) / iRad : 0;

        // Smooth radius lerp toward hover state
        const targetR = n.baseR + proximity * 5;
        n.r += (targetR - n.r) * 0.15;

        const nodeAlpha = opacity + proximity * 0.35;

        // Glow ring on hover
        if (proximity > 0.15) {
          ctx.beginPath();
          ctx.arc(nx, ny, n.r + 4 + proximity * 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 168, 107, ${proximity * 0.08})`;
          ctx.fill();
        }

        // Hub pulse ring
        if (n.hub && !reducedMotion) {
          const pr = n.baseR + n.pulse * 18;
          const pa = (1 - n.pulse) * 0.06;
          ctx.beginPath();
          ctx.arc(nx, ny, pr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 168, 107, ${pa})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // Node fill
        ctx.beginPath();
        ctx.arc(nx, ny, n.r, 0, Math.PI * 2);
        ctx.fillStyle = proximity > 0
          ? `rgba(0, 168, 107, ${nodeAlpha})`    // green on hover
          : `rgba(148, 163, 184, ${nodeAlpha})`; // grey default
        ctx.fill();

        // Bright center dot on close hover
        if (proximity > 0.4) {
          ctx.beginPath();
          ctx.arc(nx, ny, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${proximity * 0.5})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [opacity, interactionRadius, reducedMotion]);

  // Attach mouse events to window so hover works across the full page
  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <>
      {/* Canvas layer — fixed + pointer-events:none so it spans the full page */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 h-full w-full"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      />
      {/* Radial fade overlay for depth */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 25%, hsl(var(--background)) 72%)",
        }}
      />
    </>
  );
};

export default InteractiveGraphBackground;
