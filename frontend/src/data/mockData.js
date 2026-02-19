export const dashboardMetrics = [
  { key: "accounts", label: "Total Accounts Analyzed", value: "12,480", delta: "+4.3%", tone: "neutral" },
  { key: "suspicious", label: "Suspicious Accounts", value: "396", delta: "+1.8%", tone: "alert" },
  { key: "rings", label: "Fraud Rings Detected", value: "28", delta: "+2 today", tone: "alert" },
  { key: "transactions", label: "Total Transactions", value: "1,942,205", delta: "+6.1%", tone: "neutral" },
];

export const riskEntities = [
  { accountId: "ACCT-10012", riskScore: 92, threatLevel: "Critical", transactionCount: 184 },
  { accountId: "ACCT-10456", riskScore: 81, threatLevel: "Critical", transactionCount: 143 },
  { accountId: "ACCT-11029", riskScore: 74, threatLevel: "High", transactionCount: 122 },
  { accountId: "ACCT-11788", riskScore: 68, threatLevel: "High", transactionCount: 96 },
  { accountId: "ACCT-12140", riskScore: 55, threatLevel: "Medium", transactionCount: 80 },
  { accountId: "ACCT-12803", riskScore: 47, threatLevel: "Medium", transactionCount: 62 },
  { accountId: "ACCT-13221", riskScore: 32, threatLevel: "Low", transactionCount: 39 },
  { accountId: "ACCT-13999", riskScore: 22, threatLevel: "Low", transactionCount: 24 },
];
