import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import type { FraudRing, SuspiciousAccount } from "@/services/api";

interface FraudTableProps {
  fraudRings?: FraudRing[];
  suspiciousAccounts?: SuspiciousAccount[];
}

// Custom color mapping for risk levels and scores
const RISK_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  Critical: { bg: "#7f1d1d", text: "#fca5a5" },   // dark crimson
  High:     { bg: "#fce4ec", text: "#880e4f" },   // light baby pink
  Medium:   { bg: "#fef9c3", text: "#713f12" },   // light yellow
  Low:      { bg: "#1e3a5f", text: "#93c5fd" },   // blue (default)
};

const getScoreBadgeStyle = (score: number): { bg: string; text: string } => {
  if (score >= 80) return { bg: "#7f1d1d", text: "#fca5a5" };   // dark crimson
  if (score >= 60) return { bg: "#fce4ec", text: "#880e4f" };   // light baby pink
  if (score >= 40) return { bg: "#fef9c3", text: "#713f12" };   // light yellow
  return { bg: "#1e3a5f", text: "#93c5fd" };                    // blue
};

const RiskBadge = ({ label, score }: { label?: string; score?: number }) => {
  const style = label
    ? RISK_BADGE_STYLES[label] || RISK_BADGE_STYLES.Low
    : getScoreBadgeStyle(score ?? 0);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label ?? score?.toFixed(1)}
    </span>
  );
};

/** Expandable reason cell – click to show full text in a portal-rendered popup */
const ReasonCell = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Position after popup renders (two rAFs to ensure layout is done)
  const positionPopup = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!triggerRef.current || !popupRef.current) return;
        const trigger = triggerRef.current.getBoundingClientRect();
        const popup = popupRef.current.getBoundingClientRect();
        const pad = 12;
        const popupW = popup.width || 340;
        const popupH = popup.height || 100;

        // Horizontal: prefer right of text, fallback left
        let left: number;
        if (trigger.right + pad + popupW <= window.innerWidth) {
          left = trigger.right + pad;
        } else {
          left = trigger.left - pad - popupW;
          if (left < pad) left = pad;
        }

        // Vertical: align top of popup with top of row, then clamp
        let top = trigger.top;
        // If popup would overflow bottom, push it up
        if (top + popupH > window.innerHeight - pad) {
          top = window.innerHeight - pad - popupH;
        }
        // If it's now above viewport, clamp to top
        if (top < pad) top = pad;

        setPos({ left, top });
      });
    });
  }, []);

  useEffect(() => {
    if (open) positionPopup();
  }, [open, positionPopup]);

  return (
    <>
      <span
        ref={triggerRef}
        className="block max-w-[300px] truncate text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
        title="Click to expand"
      >
        {text}
      </span>
      {open &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, x: 8, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "fixed",
                left: pos.left,
                top: pos.top,
                width: 340,
                zIndex: 99999,
              }}
              className="rounded-lg border border-border bg-popover p-3 shadow-xl max-h-[50vh] overflow-auto"
            >
              <p className="text-sm leading-relaxed text-popover-foreground whitespace-pre-wrap">
                {text}
              </p>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

const FraudTable = ({ fraudRings = [], suspiciousAccounts = [] }: FraudTableProps) => {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Fraud Rings Table */}
      {fraudRings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-forensic overflow-hidden"
        >
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Fraud Rings ({fraudRings.length})
            </h2>
          </div>
          <div className="max-h-[400px] overflow-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Ring ID</TableHead>
                <TableHead className="text-xs">Pattern Type</TableHead>
                <TableHead className="text-xs">Members</TableHead>
                <TableHead className="text-xs">Risk Score</TableHead>
                <TableHead className="text-xs">Total Amount</TableHead>
                <TableHead className="text-xs">Member Accounts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fraudRings.map((ring, idx) => (
                <TableRow key={ring.ring_id || idx} className="hover:bg-accent/50">
                  <TableCell className="text-sm font-medium">
                    {ring.ring_id || `FR-${String(idx + 1).padStart(3, "0")}`}
                  </TableCell>
                  <TableCell className="text-sm">{ring.pattern_type || "Circular"}</TableCell>
                  <TableCell className="text-sm">{ring.member_accounts?.length || 0}</TableCell>
                  <TableCell>
                    <RiskBadge score={ring.risk_score || ring.avg_suspicion || 0} />
                  </TableCell>
                  <TableCell className="text-sm">
                    ${(ring.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(ring.member_accounts || []).slice(0, 8).map((m) => (
                        <span
                          key={m}
                          className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                        >
                          {m}
                        </span>
                      ))}
                      {(ring.member_accounts || []).length > 8 && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                          +{ring.member_accounts.length - 8} more
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </motion.div>
      )}

      {/* Suspicious Accounts Table */}
      {suspiciousAccounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-forensic overflow-hidden"
        >
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Suspicious Accounts ({suspiciousAccounts.length})
            </h2>
          </div>
          <div className="max-h-[500px] overflow-auto">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-1/3">Account ID</TableHead>
                  <TableHead className="text-xs w-1/3">Risk Level</TableHead>
                  <TableHead className="text-xs w-1/3">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suspiciousAccounts.map((acc) => {
                  const isExpanded = expandedAccount === acc.account_id;
                  return (
                    <TableRow
                      key={acc.account_id}
                      className="group cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() =>
                        setExpandedAccount(isExpanded ? null : acc.account_id)
                      }
                    >
                      <TableCell className="text-sm font-medium relative">
                        {acc.account_id}
                        <span className="ml-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          {isExpanded ? "Click to collapse" : "Click for explanation"}
                        </span>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 rounded-md border border-border bg-popover p-3 col-span-3"
                          >
                            <p className="text-sm leading-relaxed text-popover-foreground whitespace-pre-wrap">
                              {acc.primary_reason || "No explanation available."}
                            </p>
                          </motion.div>
                        )}
                      </TableCell>
                      <TableCell>
                        <RiskBadge label={acc.risk_level} />
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {acc.suspicion_score?.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      )}

      {fraudRings.length === 0 && suspiciousAccounts.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No fraud data to display.
        </div>
      )}
    </div>
  );
};

export default FraudTable;
