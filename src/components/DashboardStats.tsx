import React from "react";
import { Task, TaskPriority, TaskStatus } from "../types";
import { AlertTriangle, CheckCircle2, Clock, Zap, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

interface DashboardStatsProps {
  tasks: Task[];
}

export default function DashboardStats({ tasks }: DashboardStatsProps) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Urgent tasks
  const urgentTasks = tasks.filter(
    (t) => t.status === TaskStatus.PENDING && t.priority === TaskPriority.URGENT
  ).length;

  // Average risk score for pending tasks
  const pendingTasksWithRisk = tasks.filter((t) => t.status === TaskStatus.PENDING);
  const averageRiskScore =
    pendingTasksWithRisk.length > 0
      ? Math.round(
          pendingTasksWithRisk.reduce((sum, t) => sum + (t.riskScore || 0), 0) /
            pendingTasksWithRisk.length
        )
      : 0;

  // Map priorities to numerical values for chart representation
  const priorityDistribution = [
    { name: "Urgent", count: tasks.filter((t) => t.priority === TaskPriority.URGENT && t.status === TaskStatus.PENDING).length, color: "#ef4444" },
    { name: "High", count: tasks.filter((t) => t.priority === TaskPriority.HIGH && t.status === TaskStatus.PENDING).length, color: "#f97316" },
    { name: "Medium", count: tasks.filter((t) => t.priority === TaskPriority.MEDIUM && t.status === TaskStatus.PENDING).length, color: "#eab308" },
    { name: "Low", count: tasks.filter((t) => t.priority === TaskPriority.LOW && t.status === TaskStatus.PENDING).length, color: "#6366f1" },
  ];

  const getRiskLabel = (score: number) => {
    if (score >= 75) return "CRITICAL RISK";
    if (score >= 40) return "ELEVATED RISK";
    return "OPTIMAL STATUS";
  };

  const getRiskColorText = (score: number) => {
    if (score >= 75) return "text-red-500";
    if (score >= 40) return "text-amber-500";
    return "text-emerald-400";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Stat Card 1: Deadline Risk Score */}
      <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl flex flex-col gap-1 relative overflow-hidden backdrop-blur-sm shadow-xl">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
          Deadline Risk Score
        </span>
        <div className={`text-4xl font-extrabold mt-1.5 ${getRiskColorText(averageRiskScore)}`}>
          {averageRiskScore}%
        </div>
        <span className={`text-[10px] font-bold uppercase font-mono mt-1 ${getRiskColorText(averageRiskScore)}`}>
          {getRiskLabel(averageRiskScore)}
        </span>
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* Stat Card 2: Active Backlog */}
      <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl flex flex-col gap-1 relative overflow-hidden backdrop-blur-sm shadow-xl">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
          Active Backlog
        </span>
        <div className="text-4xl font-extrabold text-white mt-1.5">
          {pendingTasks < 10 ? `0${pendingTasks}` : pendingTasks}
        </div>
        <span className="text-[10px] text-slate-400 font-bold font-mono mt-1">
          {urgentTasks > 0 ? `${urgentTasks} REQUIRES IMMEDIATE DISPATCH` : "STABLE WORKLOAD"}
        </span>
      </div>

      {/* Stat Card 3: Completion Efficiency */}
      <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl flex flex-col gap-1 relative overflow-hidden backdrop-blur-sm shadow-xl">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
          Completion Rate
        </span>
        <div className="text-4xl font-extrabold text-indigo-400 mt-1.5">
          {completionRate}%
        </div>
        <span className="text-[10px] text-indigo-400/60 font-bold font-mono mt-1">
          {completedTasks} OF {totalTasks} TRACKS COMPLETED
        </span>
      </div>

      {/* Stat Card 4: AI Schedule Engine Mode */}
      <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl flex flex-col gap-1 border-l-4 border-l-indigo-500 relative overflow-hidden backdrop-blur-sm shadow-xl">
        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">
          AI Schedule Engine
        </span>
        <div className="text-lg font-bold text-white mt-2 leading-tight">
          Optimized for <br />
          {averageRiskScore >= 75 ? "URGENT RESPONSE" : "DEEP CONCENTRATION"}
        </div>
        <span className="text-[10px] text-slate-500 font-bold font-mono mt-1">
          FLIGHT PLAN READY
        </span>
      </div>

      {/* Priority Distribution Chart Row */}
      {pendingTasks > 0 && (
        <div className="md:col-span-2 lg:col-span-4 bg-slate-900/30 border border-slate-800 p-5 rounded-xl shadow-xl backdrop-blur-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 font-mono">
            Active Workload Priority Distribution
          </h3>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                  labelStyle={{ color: "#94a3b8", fontWeight: "bold", fontSize: 11 }}
                  itemStyle={{ color: "#f8fafc", fontSize: 11 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
