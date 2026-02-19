import React from "react";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "upload", label: "Upload Data", icon: "📁" },
  { key: "network", label: "Network Analysis", icon: "🕸️" },
  { key: "analytics", label: "Risk Analytics", icon: "📈" },
];

function Sidebar({ currentView, onNavigate }) {
  return (
    <aside className="fixed left-0 top-0 z-30 h-screen w-64 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Intelligence Suite</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Mule Detection</h2>
      </div>

      <nav className="space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = currentView === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 ${
                active
                  ? "bg-green-50 text-green-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className={`text-base ${active ? "text-green-600" : "text-slate-400 group-hover:text-slate-600"}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
