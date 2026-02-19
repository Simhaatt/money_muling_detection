import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import type { UploadResponse } from "@/services/api";

interface AnalyticsDashboardProps {
  data: UploadResponse;
}

const RISK_COLORS: Record<string, string> = {
  Critical: "#991b1b",
  High: "#db2777",
  Medium: "#ca8a04",
  Low: "#2563eb",
};

const PIE_COLORS = ["#991b1b", "#db2777", "#ca8a04", "#2563eb", "#6366f1", "#059669"];

const AnalyticsDashboard = ({ data }: AnalyticsDashboardProps) => {
  // 1. Risk Score Distribution
  const riskDistribution = useMemo(() => {
    const buckets = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    (data.suspicious_accounts || []).forEach((acc) => {
      const s = acc.suspicion_score || 0;
      if (s >= 80) buckets.Critical++;
      else if (s >= 60) buckets.High++;
      else if (s >= 40) buckets.Medium++;
      else buckets.Low++;
    });
    return Object.entries(buckets)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({ name, count, fill: RISK_COLORS[name] }));
  }, [data.suspicious_accounts]);

  // 2. Fraud Ring Size Distribution
  const ringSizeDistribution = useMemo(() => {
    const sizeMap: Record<string, number> = {};
    (data.fraud_rings || []).forEach((ring) => {
      const size = (ring.member_accounts || []).length;
      const label = size >= 6 ? "6+" : `${size}`;
      sizeMap[label] = (sizeMap[label] || 0) + 1;
    });
    return Object.entries(sizeMap)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([name, value]) => ({ name: `${name} members`, value }));
  }, [data.fraud_rings]);

  // 3. Top 10 Accounts by Transaction Volume
  const topAccounts = useMemo(() => {
    const volumeMap: Record<string, { inflow: number; outflow: number }> = {};
    (data.graph?.links || []).forEach((e) => {
      const amt = e.total_amount || 0;
      if (!volumeMap[e.target]) volumeMap[e.target] = { inflow: 0, outflow: 0 };
      if (!volumeMap[e.source]) volumeMap[e.source] = { inflow: 0, outflow: 0 };
      volumeMap[e.target].inflow += amt;
      volumeMap[e.source].outflow += amt;
    });
    return Object.entries(volumeMap)
      .map(([id, v]) => ({
        id: id.length > 12 ? id.slice(0, 10) + "…" : id,
        inflow: Math.round(v.inflow),
        outflow: Math.round(v.outflow),
        total: Math.round(v.inflow + v.outflow),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [data.graph?.links]);

  // 4. Transaction Amount Distribution (histogram buckets)
  const amountDistribution = useMemo(() => {
    const amounts = (data.graph?.links || []).map((e) => e.total_amount || 0).filter((a) => a > 0);
    if (amounts.length === 0) return [];
    const max = Math.max(...amounts);
    const bucketCount = Math.min(10, Math.ceil(max / 100) || 1);
    const bucketSize = Math.ceil(max / bucketCount) || 1;
    const bucketMap: { range: string; count: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const lo = i * bucketSize;
      const hi = (i + 1) * bucketSize;
      bucketMap.push({ range: `$${lo.toLocaleString()}-${hi.toLocaleString()}`, count: 0 });
    }
    amounts.forEach((a) => {
      const idx = Math.min(Math.floor(a / bucketSize), bucketCount - 1);
      bucketMap[idx].count++;
    });
    return bucketMap.filter((b) => b.count > 0);
  }, [data.graph?.links]);

  // 5. Inflow vs Outflow Scatter
  const scatterData = useMemo(() => {
    const volumeMap: Record<string, { inflow: number; outflow: number }> = {};
    (data.graph?.links || []).forEach((e) => {
      const amt = e.total_amount || 0;
      if (!volumeMap[e.target]) volumeMap[e.target] = { inflow: 0, outflow: 0 };
      if (!volumeMap[e.source]) volumeMap[e.source] = { inflow: 0, outflow: 0 };
      volumeMap[e.target].inflow += amt;
      volumeMap[e.source].outflow += amt;
    });
    const susIds = new Set((data.suspicious_accounts || []).map((a) => a.account_id));
    return Object.entries(volumeMap).map(([id, v]) => ({
      id,
      inflow: Math.round(v.inflow),
      outflow: Math.round(v.outflow),
      suspicious: susIds.has(id) ? 1 : 0,
    }));
  }, [data.graph?.links, data.suspicious_accounts]);

  // 6. Degree distribution (how many connections each node has)
  const degreeDistribution = useMemo(() => {
    const degreeMap: Record<string, number> = {};
    (data.graph?.links || []).forEach((e) => {
      degreeMap[e.source] = (degreeMap[e.source] || 0) + 1;
      degreeMap[e.target] = (degreeMap[e.target] || 0) + 1;
    });
    const degrees = Object.values(degreeMap);
    if (degrees.length === 0) return [];
    const max = Math.max(...degrees);
    const bucketCount = Math.min(15, max);
    const bucketSize = Math.max(1, Math.ceil(max / bucketCount));
    const buckets: { range: string; count: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const lo = i * bucketSize + 1;
      const hi = (i + 1) * bucketSize;
      buckets.push({ range: lo === hi ? `${lo}` : `${lo}-${hi}`, count: 0 });
    }
    degrees.forEach((d) => {
      const idx = Math.min(Math.floor((d - 1) / bucketSize), bucketCount - 1);
      buckets[idx].count++;
    });
    return buckets.filter((b) => b.count > 0);
  }, [data.graph?.links]);

  const chartCard = (title: string, subtitle: string, children: React.ReactNode) => (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
      {children}
    </div>
  );

  const axisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Risk Score Distribution */}
      {riskDistribution.length > 0 &&
        chartCard(
          "Risk Score Distribution",
          "Suspicious accounts grouped by risk level",
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={riskDistribution} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={axisStyle} />
              <YAxis tick={axisStyle} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {riskDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>,
        )}

      {/* Fraud Ring Size Distribution */}
      {ringSizeDistribution.length > 0 &&
        chartCard(
          "Fraud Ring Sizes",
          "Distribution of detected ring member counts",
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={ringSizeDistribution}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {ringSizeDistribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
            </PieChart>
          </ResponsiveContainer>,
        )}

      {/* Top 10 Accounts by Volume */}
      {topAccounts.length > 0 &&
        chartCard(
          "Top 10 Accounts by Volume",
          "Accounts with the highest total transaction value (inflow + outflow)",
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topAccounts} layout="vertical" barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={axisStyle} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="id" type="category" tick={axisStyle} width={95} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
              />
              <Bar dataKey="inflow" stackId="a" fill="#059669" name="Inflow" />
              <Bar dataKey="outflow" stackId="a" fill="#dc2626" radius={[0, 4, 4, 0]} name="Outflow" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>,
        )}

      {/* Transaction Amount Distribution */}
      {amountDistribution.length > 0 &&
        chartCard(
          "Transaction Amount Distribution",
          "Frequency of transactions by value range",
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={amountDistribution} barCategoryGap="10%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                angle={-25}
                textAnchor="end"
                height={55}
              />
              <YAxis tick={axisStyle} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} name="Transactions" />
            </BarChart>
          </ResponsiveContainer>,
        )}

      {/* Inflow vs Outflow Scatter */}
      {scatterData.length > 0 &&
        chartCard(
          "Inflow vs Outflow",
          "Each dot = account. Dots near the diagonal are pass-through (potential mules). Red = flagged.",
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="inflow" name="Inflow" tick={axisStyle} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="outflow" name="Outflow" tick={axisStyle} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <ZAxis range={[30, 30]} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.id || ""}
              />
              <Scatter
                data={scatterData.filter((d) => !d.suspicious)}
                fill="#475569"
                opacity={0.35}
                name="Normal"
              />
              <Scatter
                data={scatterData.filter((d) => d.suspicious)}
                fill="#dc2626"
                opacity={0.9}
                name="Flagged"
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ScatterChart>
          </ResponsiveContainer>,
        )}

      {/* Degree Distribution */}
      {degreeDistribution.length > 0 &&
        chartCard(
          "Connection Degree Distribution",
          "How many connections (edges) each account has — high-degree nodes are hubs",
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={degreeDistribution}>
              <defs>
                <linearGradient id="gradDegree" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" tick={axisStyle} label={{ value: "Connections", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={axisStyle} allowDecimals={false} label={{ value: "Accounts", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" fillOpacity={1} fill="url(#gradDegree)" name="Accounts" />
            </AreaChart>
          </ResponsiveContainer>,
        )}
    </div>
  );
};

export default AnalyticsDashboard;
