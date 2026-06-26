import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import {
  initAuth,
  googleSignIn,
  logout,
  db,
  handleFirestoreError,
  OperationType,
} from "./firebase";
import { Task, Schedule, TaskStatus } from "./types";
import Header from "./components/Header";
import DashboardStats from "./components/DashboardStats";
import TaskForm from "./components/TaskForm";
import TaskList from "./components/TaskList";
import AISchedulePanel from "./components/AISchedulePanel";
import { Loader2, Sparkles, Check, Compass, AlertTriangle, X } from "lucide-react";

const LOCAL_USER = {
  uid: "local_single_user",
  displayName: "Guest User",
  email: "pilot@taskpilot.local",
  photoURL: null,
} as any;

export default function App() {
  const [user, setUser] = useState<User | null>(LOCAL_USER);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Firestore tasks & schedules state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [savedSchedules, setSavedSchedules] = useState<Schedule[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);

  // Task form control
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // Selected date for scheduler
  const [activeDate, setActiveDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Initialize auth state (Workspace Integration requirement)
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
        setAuthLoading(false);
      },
      () => {
        setUser(LOCAL_USER);
        setAccessToken(null);
        setNeedsAuth(false);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync tasks in real-time from Firestore when authenticated
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    const path = "tasks";
    const q = query(collection(db, path), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedTasks: Task[] = [];
        snapshot.forEach((doc) => {
          loadedTasks.push({ id: doc.id, ...doc.data() } as Task);
        });
        setTasks(loadedTasks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Sync schedules in real-time from Firestore when authenticated
  useEffect(() => {
    if (!user) {
      setSavedSchedules([]);
      return;
    }

    const path = "schedules";
    const q = query(collection(db, path), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const schedules: Schedule[] = [];
        snapshot.forEach((doc) => {
          schedules.push({ id: doc.id, ...doc.data() } as Schedule);
        });
        setSavedSchedules(schedules);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Sync current active date's schedule
  useEffect(() => {
    const todaySchedule = savedSchedules.find((s) => s.date === activeDate);
    setActiveSchedule(todaySchedule || null);
  }, [savedSchedules, activeDate]);

  // Automatically delete the daily flight plan when all tasks are 100% completed
  useEffect(() => {
    if (tasks.length > 0 && tasks.every((t) => t.status === TaskStatus.COMPLETED)) {
      if (activeSchedule) {
        handleDeleteSchedule(activeDate).catch((err) =>
          console.error("Auto delete schedule failed:", err)
        );
      }
    }
  }, [tasks, activeDate, activeSchedule]);

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setAuthError(err?.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(LOCAL_USER);
      setAccessToken(null);
      setNeedsAuth(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Add or Edit Task in Firestore
  const handleTaskSubmit = async (taskData: any) => {
    if (!user) return;

    const path = "tasks";
    try {
      const taskId = taskData.id || `task_${Date.now()}`;
      const taskDocRef = doc(db, path, taskId);

      const payload = {
        userId: user.uid,
        title: taskData.title,
        description: taskData.description || "",
        deadline: taskData.deadline || null,
        priority: taskData.priority,
        durationMinutes: taskData.durationMinutes,
        status: taskData.status || TaskStatus.PENDING,
        riskScore: taskData.riskScore || 0,
        aiPriorityReason: taskData.aiPriorityReason || "",
        calendarEventId: taskData.calendarEventId || null,
        scheduledStartTime: taskData.scheduledStartTime || null,
        preferredStartTime: taskData.preferredStartTime || "any",
        updatedAt: new Date().toISOString(),
      };

      if (!taskData.id) {
        // Add new task
        Object.assign(payload, {
          id: taskId,
          createdAt: new Date().toISOString(),
        });
      }

      await setDoc(taskDocRef, payload, { merge: true });
      if (taskData.id) {
        setShowTaskForm(false);
        setTaskToEdit(null);
      } else {
        // Keep form open for adding more tasks, set to null to trigger resetting the inputs
        setTaskToEdit(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${taskData.id}`);
    }
  };

  // Toggle Task Completion Status
  const handleToggleTaskStatus = async (taskId: string) => {
    if (!user) return;

    const path = "tasks";
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const taskDocRef = doc(db, path, taskId);
      const newStatus = task.status === TaskStatus.PENDING ? TaskStatus.COMPLETED : TaskStatus.PENDING;

      await updateDoc(taskDocRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${taskId}`);
    }
  };

  // Delete Task from Firestore
  // Delete Task from Firestore
  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;

    const path = "tasks";
    try {
      await deleteDoc(doc(db, path, taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${taskId}`);
    }
  };

  // Sync task to Google Calendar
  const handleSyncToCalendar = async (task: Task) => {
    if (!accessToken) return;

    try {
      const response = await fetch("/api/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          currentDate: new Date().toISOString(),
        }),
      });

      const aiData = await response.json();
      const startTime = new Date().toISOString();

      // Dynamically make Google Calendar post request
      const createResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: `TaskPilot AI: ${task.title}`,
            description: `${task.description || ""}\n\nAI Priority: ${task.priority}\nAI Reasoning: ${
              aiData.aiPriorityReason || ""
            }`,
            start: {
              dateTime: startTime,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: new Date(Date.now() + task.durationMinutes * 60 * 1000).toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          }),
        }
      );

      if (!createResponse.ok) {
        throw new Error("Failed to post Google Calendar event");
      }

      const eventData = await createResponse.json();

      // Update task in Firestore
      const path = "tasks";
      const taskDocRef = doc(db, path, task.id);
      await updateDoc(taskDocRef, {
        calendarEventId: eventData.id,
        scheduledStartTime: startTime,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Remove task from Google Calendar
  const handleUnsyncFromCalendar = async (task: Task) => {
    if (!accessToken || !task.calendarEventId) return;

    try {
      const deleteResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.calendarEventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        throw new Error("Failed to delete Google Calendar event");
      }

      // Update task in Firestore
      const path = "tasks";
      const taskDocRef = doc(db, path, task.id);
      await updateDoc(taskDocRef, {
        calendarEventId: null,
        scheduledStartTime: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Save generated schedule to Firestore
  const handleSaveSchedule = async (scheduleData: any) => {
    if (!user) return;

    const path = "schedules";
    try {
      const scheduleId = `sched_${scheduleData.date}_${user.uid}`;
      const scheduleDocRef = doc(db, path, scheduleId);

      const newSchedule: Schedule = {
        id: scheduleId,
        userId: user.uid,
        date: scheduleData.date,
        timeSlots: scheduleData.timeSlots,
        aiSummary: scheduleData.aiSummary,
        createdAt: new Date().toISOString(),
      };

      // Optimistically update local states
      setSavedSchedules((prev) => {
        const filtered = prev.filter((s) => s.id !== scheduleId);
        return [...filtered, newSchedule];
      });
      setActiveSchedule(newSchedule);

      await setDoc(scheduleDocRef, newSchedule);
    } catch (error) {
      console.error("Firestore Save failed, keeping local preview:", error);
    }
  };

  // Delete generated/saved schedule from Firestore
  const handleDeleteSchedule = async (date: string) => {
    if (!user) return;

    const path = "schedules";
    const scheduleId = `sched_${date}_${user.uid}`;
    try {
      // Optimistically clear local states
      setSavedSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      setActiveSchedule(null);

      const scheduleDocRef = doc(db, path, scheduleId);
      await deleteDoc(scheduleDocRef);
    } catch (error) {
      console.error("Firestore Delete failed, keeping local state cleared:", error);
      // Fallback: make sure state stays cleared
      setSavedSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      setActiveSchedule(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-widest font-mono">
          Verifying TaskPilot Core...
        </p>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden px-4">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Card */}
        <div className="max-w-md w-full bg-slate-900/40 border border-slate-800 rounded-xl p-8 shadow-2xl relative z-10 space-y-6 text-center backdrop-blur-md">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-indigo-500 rounded flex items-center justify-center font-black italic text-white text-lg select-none">
              TP
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              TaskPilot <span className="text-indigo-400">AI</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">
              PROACTIVE FLIGHT & PRODUCTIVITY Companion
            </p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              An intelligent, boxy slate environment optimizing your tasks and dynamically publishing schedules directly to your Google Calendar.
            </p>
          </div>

          {/* Features bullet points */}
          <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-lg text-left space-y-3.5">
            <div className="flex items-start space-x-2.5 text-xs">
              <Check className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span className="text-slate-300">
                <strong className="text-slate-200">AI Prioritization</strong>: Evaluates and updates urgency weights based on deadlines.
              </span>
            </div>
            <div className="flex items-start space-x-2.5 text-xs">
              <Check className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span className="text-slate-300">
                <strong className="text-slate-200">Daily Flight Planner</strong>: Direct schedule generation matching free Google Calendar slots.
              </span>
            </div>
            <div className="flex items-start space-x-2.5 text-xs">
              <Check className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span className="text-slate-300">
                <strong className="text-slate-200">Interactive Sync</strong>: Keep your calendar active and updated with optimized task slots.
              </span>
            </div>
          </div>

          {/* Official Sign In With Google Button */}
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-slate-50 text-slate-950 py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-black/10 cursor-pointer"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              ></path>
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              ></path>
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              ></path>
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              ></path>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Header user={user!} onLogout={handleLogout} onLogin={handleLogin} syncEnabled={!!accessToken} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {authError && (
          <div className="bg-amber-950/40 border border-amber-900/60 p-5 rounded-xl flex items-start justify-between gap-4 animate-fade-in backdrop-blur-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400 font-mono">
                  Calendar Sync Authentication Issue
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  We encountered an issue attempting to connect to Google Calendar:
                </p>
                <div className="bg-slate-950/75 border border-slate-900 px-3 py-2 rounded text-[11px] text-slate-400 font-mono select-all overflow-x-auto max-w-full">
                  {authError}
                </div>
                <div className="text-[11px] text-slate-400 space-y-1 pt-1.5">
                  <p className="font-semibold text-slate-300 uppercase tracking-wider text-[9px] font-mono">How to resolve this on your local computer:</p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>
                      <span className="font-semibold text-slate-200">Popup Blocker:</span> If nothing happened when clicking the button, check the top-right of your browser's address bar. Your browser likely blocked the login popup window. Click the "Popup Blocked" icon and choose "Always allow popups."
                    </li>
                    <li>
                      <span className="font-semibold text-slate-200">Authorized Domain:</span> If the popup opened but showed an error saying this domain is unauthorized, go to your Firebase Console under <span className="font-mono text-indigo-400">Authentication &gt; Settings &gt; Authorized Domains</span>, and add <span className="font-mono text-indigo-400">localhost</span> to the authorized domains.
                    </li>
                    <li>
                      <span className="font-semibold text-slate-200">Google OAuth API:</span> Make sure your Google Auth Provider has <span className="font-mono text-indigo-400">Calendar APIs</span> enabled in your Google Cloud Developer Console.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={() => setAuthError(null)}
              className="text-slate-500 hover:text-slate-300 transition-all p-1 hover:bg-slate-900 rounded cursor-pointer"
              title="Dismiss error"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        )}

        {/* Analytics Bento Grid */}
        <DashboardStats tasks={tasks} />

        {/* Dashboard Split Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left/Middle Column: Tasks Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Controls & Panel */}
            <div className="flex justify-between items-center bg-slate-900/40 border border-slate-800 p-5 rounded-xl shadow-md backdrop-blur-sm">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 font-mono">Active Backlog</h2>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Manage, prioritize, and sync tasks to your schedule</p>
              </div>
              {!showTaskForm && (
                <button
                  onClick={() => {
                    setTaskToEdit(null);
                    setShowTaskForm(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>PILOT TASK</span>
                </button>
              )}
            </div>

            {/* Slide-over form trigger */}
            {showTaskForm && (
              <TaskForm
                taskToEdit={taskToEdit}
                onSubmit={handleTaskSubmit}
                onCancel={() => {
                  setShowTaskForm(false);
                  setTaskToEdit(null);
                }}
              />
            )}

            {/* Real task backlog list */}
            <TaskList
              tasks={tasks}
              onToggleStatus={handleToggleTaskStatus}
              onEdit={(task) => {
                setTaskToEdit(task);
                setShowTaskForm(true);
                window.scrollTo({ top: 320, behavior: "smooth" });
              }}
              onDelete={handleDeleteTask}
              onSyncToCalendar={handleSyncToCalendar}
              onUnsyncFromCalendar={handleUnsyncFromCalendar}
              calendarConnected={!!accessToken}
            />
          </div>

          {/* Right Column: AI Schedule Timeline Planner */}
          <div className="lg:col-span-1">
            <AISchedulePanel
              tasks={tasks}
              accessToken={accessToken}
              onSaveSchedule={handleSaveSchedule}
              savedSchedule={activeSchedule}
              activeDate={activeDate}
              onDateChange={setActiveDate}
              onDeleteSchedule={handleDeleteSchedule}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
