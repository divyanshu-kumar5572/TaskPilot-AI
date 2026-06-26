import React, { useState } from "react";
import { Task, TaskPriority, TaskStatus } from "../types";
import {
  Calendar,
  Clock,
  Trash2,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface TaskListProps {
  tasks: Task[];
  onToggleStatus: (taskId: string) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => Promise<void>;
  onSyncToCalendar: (task: Task) => Promise<void>;
  onUnsyncFromCalendar: (task: Task) => Promise<void>;
  calendarConnected: boolean;
}

type SortKey = "priority" | "deadline" | "riskScore" | "createdAt";

export default function TaskList({
  tasks,
  onToggleStatus,
  onEdit,
  onDelete,
  onSyncToCalendar,
  onUnsyncFromCalendar,
  calendarConnected,
}: TaskListProps) {
  const [filter, setFilter] = useState<TaskStatus | "all">(TaskStatus.PENDING);
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const getPriorityWeight = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.URGENT:
        return 4;
      case TaskPriority.HIGH:
        return 3;
      case TaskPriority.MEDIUM:
        return 2;
      case TaskPriority.LOW:
        return 1;
      default:
        return 0;
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "priority") {
      return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    }
    if (sortBy === "riskScore") {
      return (b.riskScore || 0) - (a.riskScore || 0);
    }
    if (sortBy === "deadline") {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getPriorityBadgeClass = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.URGENT:
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case TaskPriority.HIGH:
        return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case TaskPriority.MEDIUM:
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case TaskPriority.LOW:
        return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return "bg-red-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const formatDeadline = (isoString?: string) => {
    if (!isoString) return "No hard deadline";
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} mins`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} hr${h > 1 ? "s" : ""} ${m} min${m > 1 ? "s" : ""}` : `${h} hr${h > 1 ? "s" : ""}`;
  };

  const formatPreferredStartTime = (val?: string) => {
    switch (val) {
      case "now":
        return "Start from now";
      case "30m":
        return "Start in 30m";
      case "1h":
        return "Start after 1h";
      case "2h":
        return "Start after 2h";
      case "4h":
        return "Start after 4h";
      case "tomorrow":
        return "Start tomorrow";
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and sorting panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 border border-slate-800 p-4 rounded-xl shadow-md">
        {/* Filter buttons */}
        <div className="flex bg-slate-950/60 p-1 rounded-lg border border-slate-850">
          <button
            onClick={() => setFilter(TaskStatus.PENDING)}
            className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === TaskStatus.PENDING
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Active Backlog
          </button>
          <button
            onClick={() => setFilter(TaskStatus.COMPLETED)}
            className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === TaskStatus.COMPLETED
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Dispatched
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            All Tracks
          </button>
        </div>

        {/* Sorting selection */}
        <div className="flex items-center space-x-2.5">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-slate-950/60 border border-slate-850 rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          >
            <option value="priority">AI Priority</option>
            <option value="riskScore">Deadline Risk</option>
            <option value="deadline">Target Deadline</option>
            <option value="createdAt">Date Created</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {sortedTasks.length === 0 ? (
          <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-xl p-12 text-center">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">No tasks on this track</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Add a new task or modify filters to see your productivity pipeline.
            </p>
          </div>
        ) : (
          sortedTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            return (
              <div
                key={task.id}
                className={`bg-slate-900/30 border border-slate-800 rounded-lg shadow-lg transition-all duration-300 overflow-hidden ${
                  task.status === TaskStatus.COMPLETED ? "opacity-60" : ""
                }`}
              >
                {/* Task Main Row */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Side: Status checkbox & Title */}
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <button
                      onClick={() => onToggleStatus(task.id)}
                      className={`mt-1 flex-shrink-0 w-5 h-5 rounded-none border flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        task.status === TaskStatus.COMPLETED
                          ? "bg-indigo-600 border-indigo-400 text-white"
                          : "border-slate-800 hover:border-indigo-500 bg-slate-950"
                      }`}
                    >
                      {task.status === TaskStatus.COMPLETED && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className={`text-sm font-bold tracking-tight text-slate-100 truncate ${
                            task.status === TaskStatus.COMPLETED ? "line-through text-slate-500" : ""
                          }`}
                        >
                          {task.title}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono border ${getPriorityBadgeClass(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {task.description || "No context provided."}
                      </p>

                      {/* Info Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-600" />
                          <span>{formatDeadline(task.deadline)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                          <span>{formatDuration(task.durationMinutes)}</span>
                        </span>
                        {task.preferredStartTime && task.preferredStartTime !== "any" && (
                          <span className="flex items-center space-x-1 text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded text-[9px] border border-indigo-500/20 font-mono uppercase tracking-wider font-semibold">
                            <span>⏱ {formatPreferredStartTime(task.preferredStartTime)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Risk score, Expand AI & Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-5 border-t border-slate-800/60 lg:border-none pt-4 lg:pt-0">
                    {/* Risk Score indicator */}
                    <div className="space-y-1 w-28">
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                        <span>Risk Score</span>
                        <span>{task.riskScore}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-950 rounded-none overflow-hidden border border-slate-850">
                        <div
                          className={`h-full rounded-none ${getRiskColor(task.riskScore)}`}
                          style={{ width: `${task.riskScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2.5">
                      {/* Google Calendar sync status button */}
                      {calendarConnected && task.status === TaskStatus.PENDING && (
                        <button
                          onClick={() =>
                            task.calendarEventId
                              ? onUnsyncFromCalendar(task)
                              : onSyncToCalendar(task)
                          }
                          className={`p-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 transition-all duration-200 cursor-pointer ${
                            task.calendarEventId
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                              : "bg-slate-950/60 border-slate-850 text-slate-500 hover:text-indigo-400 hover:border-indigo-400/40"
                          }`}
                          title={task.calendarEventId ? "Unsync Google Event" : "Sync as Calendar Event"}
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span className="hidden sm:inline">
                            {task.calendarEventId ? "Synced" : "Sync"}
                          </span>
                        </button>
                      )}

                      {/* AI Reason toggle */}
                      {task.aiPriorityReason && (
                        <button
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="p-2 rounded-lg bg-slate-950/60 border border-slate-850 text-slate-500 hover:text-indigo-400 hover:border-indigo-400/40 transition-colors cursor-pointer"
                          title="Show AI Reasoning"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}

                      {/* Edit Button */}
                      <button
                        onClick={() => onEdit(task)}
                        className="p-2 rounded-lg bg-slate-950/60 border border-slate-850 text-slate-500 hover:text-indigo-400 hover:border-indigo-400/40 transition-colors cursor-pointer"
                        title="Edit Task Parameters"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDelete(task.id)}
                        className="p-2 rounded-lg bg-slate-950/60 border border-slate-850 text-slate-500 hover:text-red-400 hover:border-red-400/40 transition-colors cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded AI Reasoning Block */}
                {isExpanded && task.aiPriorityReason && (
                  <div className="bg-slate-950 border-t border-slate-850 p-4 animate-slideDown">
                    <div className="flex items-start space-x-2.5">
                      <div className="bg-indigo-500/10 p-1.5 rounded border border-indigo-400/20 text-indigo-400 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">
                          TaskPilot AI Smart Assessment
                        </h5>
                        <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-900/50 p-3 rounded-lg border border-slate-850">
                          "{task.aiPriorityReason}"
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
