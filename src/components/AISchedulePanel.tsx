import React, { useState, useEffect } from "react";
import { Schedule, Task, TimeSlot, SlotType } from "../types";
import { fetchCalendarEvents, createCalendarEvent } from "../calendarService";
import {
  Sparkles,
  Calendar,
  Clock,
  Coffee,
  CheckCircle2,
  CalendarDays,
  Loader2,
  Zap,
  Trash2,
  AlertCircle
} from "lucide-react";

interface AISchedulePanelProps {
  tasks: Task[];
  accessToken: string | null;
  onSaveSchedule: (schedule: Omit<Schedule, "id" | "userId" | "createdAt">) => Promise<void>;
  savedSchedule: Schedule | null;
  activeDate: string;
  onDateChange: (date: string) => void;
  onDeleteSchedule: (date: string) => Promise<void>;
}

export default function AISchedulePanel({
  tasks,
  accessToken,
  onSaveSchedule,
  savedSchedule,
  activeDate,
  onDateChange,
  onDeleteSchedule,
}: AISchedulePanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Local preview of generated schedule
  const [generatedSchedule, setGeneratedSchedule] = useState<{
    aiSummary: string;
    timeSlots: TimeSlot[];
  } | null>(null);

  const activePendingTasks = tasks.filter((t) => t.status === "pending");

  // Reset temporary preview when switching dates or when savedSchedule changes
  useEffect(() => {
    setGeneratedSchedule(null);
    setExportSuccess(false);
    setExportError(null);
    setShowClearConfirm(false);
    setShowExportConfirm(false);
  }, [activeDate, savedSchedule]);

  const handleGenerateSchedule = async () => {
    setIsGenerating(false);
    setExportSuccess(false);
    setIsGenerating(true);

    try {
      let calendarEvents = [];
      if (accessToken) {
        try {
          // Fetch events from Google Calendar to plan around them
          calendarEvents = await fetchCalendarEvents(accessToken, activeDate);
        } catch (calErr) {
          console.error("Could not fetch calendar events:", calErr);
        }
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const clientDate = `${year}-${month}-${day}`;
      const clientTime = now.toTimeString().split(" ")[0].substring(0, 5);

      const response = await fetch("/api/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: activePendingTasks,
          calendarEvents,
          targetDate: activeDate,
          clientDate,
          clientTime,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate schedule from AI");
      }

      const data = await response.json();
      setGeneratedSchedule(data);
      setIsGenerating(false); // Stop spinner immediately when plan is loaded!

      // Save generated schedule to Firestore in the background
      onSaveSchedule({
        date: activeDate,
        timeSlots: data.timeSlots,
        aiSummary: data.aiSummary,
      }).catch((saveErr) => {
        console.error("Firestore Save failed in background:", saveErr);
      });
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
    }
  };

  const handleExportToGoogleCalendar = async () => {
    const currentSchedule = generatedSchedule || savedSchedule;
    if (!currentSchedule || !accessToken) return;

    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);

    try {
      const taskSlots = currentSchedule.timeSlots.filter((slot) => slot.type === SlotType.TASK);

      for (const slot of taskSlots) {
        const startIso = `${activeDate}T${slot.startTime}:00`;
        const taskObj = tasks.find((t) => t.id === slot.taskId) || { description: "" };

        // Calculate duration in minutes
        const [sh, sm] = slot.startTime.split(":").map(Number);
        const [eh, em] = slot.endTime.split(":").map(Number);
        const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

        await createCalendarEvent(
          accessToken,
          slot.title,
          taskObj.description || slot.notes || "Optimized task slot.",
          startIso,
          durationMinutes > 0 ? durationMinutes : 45
        );
      }

      setExportSuccess(true);
    } catch (err: any) {
      console.error("Export failed:", err);
      setExportError(err?.message || String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteScheduleClick = async () => {
    try {
      setGeneratedSchedule(null);
      setShowClearConfirm(false);
      await onDeleteSchedule(activeDate);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const formatTimeToAMPM = (timeStr: string) => {
    if (!timeStr) return "";
    const trimmed = timeStr.trim();
    // Support matching "HH:MM" pattern
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return timeStr; // fallback to original if format is unexpected
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    return `${hours}:${minutes} ${ampm}`;
  };

  const getSlotTypeBadge = (type: SlotType) => {
    switch (type) {
      case SlotType.TASK:
        return {
          icon: <Zap className="w-3 h-3" />,
          style: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          label: "TASK SLOT",
        };
      case SlotType.CALENDAR_EVENT:
        return {
          icon: <CalendarDays className="w-3 h-3" />,
          style: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          label: "CALENDAR MTG",
        };
      case SlotType.BREAK:
        return {
          icon: <Coffee className="w-3 h-3" />,
          style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "RECHARGE",
        };
      case SlotType.BUFFER:
        return {
          icon: <Clock className="w-3 h-3" />,
          style: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          label: "BUFFER",
        };
    }
  };

  const displaySchedule = generatedSchedule || savedSchedule;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden h-full flex flex-col backdrop-blur-sm animate-fade-in">
      {/* Background accent glow */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center mb-6 gap-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white font-mono flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>AI Flight Plan</span>
        </h3>

        {/* Date Selector */}
        <input
          type="date"
          value={activeDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
        />
      </div>

      {/* Generate trigger */}
      {activePendingTasks.length === 0 && !displaySchedule ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-950/30 border border-slate-850 rounded-xl">
          <Calendar className="w-8 h-8 text-slate-600 mb-3" />
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-medium">
            All caught up! Add pending tasks to your backlog to auto-generate an optimized schedule.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-6">
          <div className="flex items-center space-x-3 bg-slate-950/60 p-4 rounded-lg border border-slate-850 justify-between gap-2">
            <div className="space-y-0.5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Optimization Engine
              </h4>
              <p className="text-[10px] text-slate-500 font-medium">
                Schedules {activePendingTasks.length} tasks around calendar slots
              </p>
            </div>
            <div className="flex items-center gap-2">
              {displaySchedule && (
                <div className="relative">
                  {showClearConfirm ? (
                    <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded shadow-lg animate-fade-in">
                      <button
                        onClick={handleDeleteScheduleClick}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider text-[8px] px-2 py-1.5 rounded cursor-pointer"
                      >
                        CONFIRM
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider text-[8px] px-2 py-1.5 rounded cursor-pointer"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="bg-rose-950/40 hover:bg-rose-900 border border-rose-850 text-rose-400 font-bold uppercase tracking-wider text-[10px] px-3 py-2.5 rounded transition-all cursor-pointer flex items-center gap-1.5"
                      title="Clear daily schedule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">CLEAR</span>
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={handleGenerateSchedule}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>COMPUTING...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 animate-pulse" />
                    <span>OPTIMIZE DAY</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Strategy Summary Card */}
          {displaySchedule && (
            <div className="bg-indigo-950/20 border border-indigo-500/10 p-4 rounded-lg space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest font-mono">
                  Pilot Strategic Summary
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{displaySchedule.aiSummary}"
              </p>
            </div>
          )}

          {/* Chronological Timeline */}
          {displaySchedule ? (
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[380px] pr-2 scrollbar-thin">
              {displaySchedule.timeSlots.map((slot, index) => {
                const badge = getSlotTypeBadge(slot.type);
                return (
                  <div key={index} className="flex space-x-4 items-start relative pl-1">
                    {/* Time side rail */}
                    <div className="w-16 text-right flex-shrink-0 pt-1">
                      <span className="text-[10px] font-bold text-slate-300 font-mono block whitespace-nowrap">
                        {formatTimeToAMPM(slot.startTime)}
                      </span>
                      <span className="block text-[9px] text-slate-500 font-mono whitespace-nowrap">
                        {formatTimeToAMPM(slot.endTime)}
                      </span>
                    </div>

                    {/* Timeline diamond bullet connector */}
                    <div className="flex flex-col items-center h-full pt-2 flex-shrink-0">
                      <div className="w-2 h-2 bg-indigo-500 rotate-45 border border-indigo-400" />
                      {index < displaySchedule.timeSlots.length - 1 && (
                        <div className="w-[1px] h-16 bg-slate-800" />
                      )}
                    </div>

                    {/* Time-slot Content Card */}
                    <div className="flex-1 bg-slate-950/60 border border-slate-850 p-3.5 rounded-lg space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h5 className="text-xs font-bold text-slate-200 line-clamp-1 font-sans">{slot.title}</h5>
                        <span
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono border ${badge.style}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </div>
                      {slot.notes && (
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                          {slot.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Export Trigger */}
              {accessToken && (
                <div className="pt-4 border-t border-slate-850 space-y-3">
                  {exportError && (
                    <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded-lg flex items-start gap-2 text-left animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h6 className="text-[10px] font-bold uppercase tracking-widest text-rose-400 font-mono">
                          Export Error
                        </h6>
                        <p className="text-[11px] text-slate-300 leading-relaxed break-words font-mono">
                          {exportError}
                        </p>
                        <p className="text-[10px] text-slate-400 leading-normal font-sans">
                          Please verify that the <span className="text-indigo-400 font-mono font-semibold">Google Calendar API</span> is enabled in your Google Cloud Console for this Firebase project.
                        </p>
                      </div>
                    </div>
                  )}

                  {showExportConfirm ? (
                    <div className="flex flex-col gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg animate-fade-in text-center">
                      <p className="text-[10px] text-slate-400 font-medium">
                        Export daily schedule events to Google Calendar?
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => {
                            setShowExportConfirm(false);
                            handleExportToGoogleCalendar();
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] px-3 py-1.5 rounded uppercase tracking-wider cursor-pointer"
                        >
                          Confirm Export
                        </button>
                        <button
                          onClick={() => setShowExportConfirm(false)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] px-3 py-1.5 rounded uppercase tracking-wider cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowExportConfirm(true)}
                      disabled={isExporting}
                      className="w-full bg-slate-950 hover:bg-slate-900 text-indigo-400 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/30 text-[10px] font-bold py-2.5 rounded uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>EXPORTING...</span>
                        </>
                      ) : exportSuccess ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">EXPORT SUCCESSFUL</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-3 h-3" />
                          <span>EXPORT TO GOOGLE CALENDAR</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <Sparkles className="w-6 h-6 text-indigo-500/30 mb-3 animate-pulse" />
              <p className="text-xs text-slate-500 max-w-xs font-sans leading-relaxed">
                Select your target date, and click "Optimize Day" to compute an automated productivity timeline.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
