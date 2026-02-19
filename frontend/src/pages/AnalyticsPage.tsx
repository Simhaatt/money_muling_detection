import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import type { UploadResponse } from "@/services/api";

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<UploadResponse | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("analysisResults");
    if (raw) {
      try {
        setData(JSON.parse(raw));
      } catch {
        navigate("/results");
      }
    } else {
      navigate("/results");
    }
  }, [navigate]);

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  const totalNodes = data.graph?.nodes?.length || 0;
  const totalEdges = data.graph?.links?.length || 0;
  const susCount = data.suspicious_accounts?.length || 0;
  const ringCount = data.fraud_rings?.length || 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate("/results")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Results
            </Button>
            <div className="flex items-center gap-2">
              <div className="gradient-primary flex h-9 w-9 items-center justify-center rounded-lg">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Analytics Dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  {totalNodes.toLocaleString()} accounts &middot; {totalEdges.toLocaleString()} transactions &middot; {susCount} flagged &middot; {ringCount} rings
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Charts */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AnalyticsDashboard data={data} />
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
