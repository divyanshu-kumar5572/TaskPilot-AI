import React, { useState, useEffect } from "react";
import { Task, TaskPriority, TaskStatus } from "../types";
import { Sparkles, Calendar, Clock, ArrowRight } from "lucide-react";

interface TaskFormProps {
  taskToEdit?: Task | null;
  onSubmit: (taskData: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>;
  onCancel: () => void;
}

export default function TaskForm({ taskToEdit, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [deadline, setDeadline] = useState("");
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [preferredStartTime, setPreferredStartTime] = useState("any");

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiPreview, setAiPreview] = useState<{
    priority: TaskPriority;
    riskScore: number;
    aiPriorityReason: string;
  } | null>(null);

  // Load editing task data
  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || "");
      setPriority(taskToEdit.priority);
      setDeadline(taskToEdit.deadline ? taskToEdit.deadline.slice(0, 16) : "");
      
      const totalMin = taskToEdit.durationMinutes || 45;
      setDurationHours(Math.floor(totalMin / 60));
      setDurationMinutes(totalMin % 60);
      setPreferredStartTime(taskToEdit.preferredStartTime || "any");

      if (taskToEdit.aiPriorityReason) {
        setAiPreview({
          priority: taskToEdit.priority,
          riskScore: taskToEdit.riskScore || 0,
          aiPriorityReason: taskToEdit.aiPriorityReason,
        });
      } else {
        setAiPreview(null);
      }
    } else {
      setTitle("");
      setDescription("");
      setPriority(TaskPriority.MEDIUM);
      setDeadline("");
      setDurationHours(0);
      setDurationMinutes(45);
      setPreferredStartTime("any");
      setAiPreview(null);
    }
  }, [taskToEdit]);

  // Handle AI analysis preview
  const handleAIAnalysis = async () => {
    if (!title.trim()) return;
    setIsAnalyzing(true);
    const totalMinutes = (durationHours * 60) + durationMinutes;
    try {
      const response = await fetch("/api/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: {
            title,
            description,
            deadline: deadline ? new Date(deadline).toISOString() : undefined,
            durationMinutes: totalMinutes,
            priority,
            preferredStartTime,
          },
          currentDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("AI prioritization service offline");
      }

      const data = await response.json();
      setAiPreview(data);
      // Automatically apply AI-recommended priority level to form
      if (data.priority) {
        setPriority(data.priority);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Use AI values if they have been previewed, otherwise calculate default risk based on deadline proximity
    let finalPriority = priority;
    let finalRiskScore = aiPreview?.riskScore || 0;
    let finalAiPriorityReason = aiPreview?.aiPriorityReason || "";

    const totalMinutes = (durationHours * 60) + durationMinutes;

    if (!aiPreview && deadline) {
      // Heuristic fallback if AI was not queried
      const hoursLeft = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft <= 0) finalRiskScore = 100;
      else if (hoursLeft < 12) finalRiskScore = 90;
      else if (hoursLeft < 24) finalRiskScore = 75;
      else if (hoursLeft < 72) finalRiskScore = 40;
      else finalRiskScore = 15;
    }

    await onSubmit({
      id: taskToEdit?.id,
      title: title.trim(),
      description: description.trim(),
      priority: finalPriority,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      durationMinutes: totalMinutes,
      status: taskToEdit ? taskToEdit.status : TaskStatus.PENDING,
      riskScore: finalRiskScore,
      aiPriorityReason: finalAiPriorityReason,
      preferredStartTime,
    });

    // Reset/refresh fields upon launch/save
    setTitle("");
    setDescription("");
    setPriority(TaskPriority.MEDIUM);
    setDeadline("");
    setDurationHours(0);
    setDurationMinutes(45);
    setPreferredStartTime("any");
    setAiPreview(null);
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
      {/* Visual Accent Glow */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-5 font-mono flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <span>{taskToEdit ? "Edit Task Parameters" : "Quick Entry & Configuration"}</span>
      </h3>

      <form onSubmit={handleFormSubmit} className="space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Task Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., UI Engineering Strategy"
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Context & Details</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Focus block context. No notifications..."
            rows={3}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
          />
        </div>

        {/* Grid parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Deadline */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Deadline</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Estimated Duration</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 pr-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 font-mono">
                  HRS
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 pr-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 font-mono">
                  MIN
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Priority and Preferred Start Time row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            >
              <option value={TaskPriority.LOW}>Low Priority</option>
              <option value={TaskPriority.MEDIUM}>Medium Standard</option>
              <option value={TaskPriority.HIGH}>High Priority</option>
              <option value={TaskPriority.URGENT}>Urgent Action</option>
            </select>
          </div>

          {/* Preferred Start Time */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Preferred Start Time</label>
            <select
              value={preferredStartTime}
              onChange={(e) => setPreferredStartTime(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            >
              <option value="any">Flexible / Anytime</option>
              <option value="now">Start from now</option>
              <option value="30m">Start after 30 minutes</option>
              <option value="1h">Start after 1 hour</option>
              <option value="2h">Start after 2 hours</option>
              <option value="4h">Start after 4 hours</option>
              <option value="tomorrow">Start tomorrow</option>
            </select>
          </div>
        </div>

        {/* AI Action Preview Trigger */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1.5 font-mono uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Pilot AI Advisor</span>
            </span>
            <button
              type="button"
              disabled={isAnalyzing || !title.trim()}
              onClick={handleAIAnalysis}
              className="text-[10px] bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-2.5 py-1.5 rounded border border-indigo-400/20 font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              {isAnalyzing ? "Recalibrating..." : "Analyze Priority"}
            </button>
          </div>

          {aiPreview && (
            <div className="space-y-2 border-t border-slate-850 pt-3 animate-fadeIn">
              <div className="flex items-center gap-3 text-[10px] font-mono uppercase font-bold text-slate-400">
                <span>AI Priority:</span>
                <span className="text-indigo-400 font-extrabold">{aiPreview.priority}</span>
                <span className="text-slate-800">|</span>
                <span>Calculated Risk:</span>
                <span className="text-red-400 font-extrabold">{aiPreview.riskScore}%</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950 border border-slate-850 p-3 rounded-lg">
                "{aiPreview.aiPriorityReason}"
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <span>{taskToEdit ? "Save Parameters" : "Launch Task"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
