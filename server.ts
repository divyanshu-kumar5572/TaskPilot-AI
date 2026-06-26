import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Initialize Express
const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to generate content with transient retry logic
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    model: string;
    contents: any;
    config?: any;
  },
  maxRetries = 2
) {
  let attempt = 0;
  // Deep clone config to avoid mutating references across fallbacks
  const finalParams = { ...params };
  if (finalParams.config) {
    finalParams.config = { ...finalParams.config };
    if (!finalParams.model.startsWith("gemini-3") && finalParams.config.thinkingConfig) {
      delete finalParams.config.thinkingConfig;
    }
  }

  while (true) {
    try {
      return await ai.models.generateContent(finalParams);
    } catch (error: any) {
      attempt++;
      const errStr = [
        typeof error === "string" ? error : "",
        error?.message || "",
        error?.status || "",
        error?.code || "",
        String(error),
        JSON.stringify(error || {})
      ].join(" ").toUpperCase();
      
      const isTransient = 
        errStr.includes("503") || 
        errStr.includes("UNAVAILABLE") ||
        errStr.includes("429") ||
        errStr.includes("RESOURCE_EXHAUSTED") ||
        errStr.includes("HIGH DEMAND") ||
        errStr.includes("TEMPORARY") ||
        errStr.includes("BUSY") ||
        errStr.includes("LIMIT");

      if (isTransient && attempt <= maxRetries) {
        console.warn(`[TaskPilot AI] Transient error on model ${params.model} (attempt ${attempt}/${maxRetries}):`, error.message || error);
        // Wait with a small delay
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        continue;
      }
      throw error;
    }
  }
}

// Helper to handle fallback models in case the primary is unavailable
async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  },
  models: string[] = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]
) {
  let lastError: any = null;
  for (const model of models) {
    try {
      console.log(`[TaskPilot AI] Attempting generateContent with model: ${model}`);
      const response = await generateContentWithRetry(ai, { ...params, model });
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`[TaskPilot AI] Failed with model ${model}:`, error.message || error);
      
      const errStr = [
        typeof error === "string" ? error : "",
        error?.message || "",
        error?.status || "",
        error?.code || "",
        String(error),
        JSON.stringify(error || {})
      ].join(" ").toUpperCase();
      
      const isTransient = 
        errStr.includes("503") || 
        errStr.includes("UNAVAILABLE") ||
        errStr.includes("429") ||
        errStr.includes("RESOURCE_EXHAUSTED") ||
        errStr.includes("HIGH DEMAND") ||
        errStr.includes("TEMPORARY") ||
        errStr.includes("BUSY") ||
        errStr.includes("LIMIT");
      
      if (!isTransient) {
        // If it's a structural/validation error, propagate it immediately
        throw error;
      }
    }
  }
  throw lastError || new Error("All model fallback attempts failed.");
}

// AI Prioritization Endpoint
app.post("/api/prioritize", async (req, res) => {
  try {
    const { task, currentDate } = req.body;
    if (!task || !task.title) {
      return res.status(400).json({ error: "Task with title is required" });
    }

    const ai = getGeminiClient();

    const prompt = `
      Evaluate the priority, risk of missing the deadline, and provide a coaching recommendation for the following task.
      Current Date/Time: ${currentDate || new Date().toISOString()}

      Task Details:
      - Title: "${task.title}"
      - Description: "${task.description || "No description provided."}"
      - Deadline: ${task.deadline ? task.deadline : "No hard deadline"}
      - Estimated Duration: ${task.durationMinutes || 30} minutes
      - User-selected Priority: ${task.priority || "medium"}

      Consider:
      1. Proximity to deadline: Urgent deadlines increase the priority and risk score dramatically.
      2. Priority level: Re-evaluate whether high, medium, low, or urgent is most appropriate.
      3. Risk Score: 0-100 score indicating chance of missing deadline based on time remaining and duration.
      4. Actionable Coaching Reason: Explain exactly why this priority and risk score were assigned, and give an actionable, empowering tip to get it done. Keep it direct and encouraging.
    `;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction: "You are TaskPilot AI, an elite proactive productivity optimizer. You analyze tasks and deadlines to help users make better planning decisions and defeat procrastination.",
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              enum: ["low", "medium", "high", "urgent"],
              description: "The adjusted AI priority recommendation.",
            },
            riskScore: {
              type: Type.INTEGER,
              description: "Risk score from 0 (none) to 100 (extreme danger of missing deadline).",
            },
            aiPriorityReason: {
              type: Type.STRING,
              description: "A concise, motivating explanation (1-2 sentences) of the priority level and risk, with a tip.",
            },
          },
          required: ["priority", "riskScore", "aiPriorityReason"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini");
    }

    const aiData = JSON.parse(resultText);
    res.json(aiData);
  } catch (error: any) {
    console.error("Error in AI Prioritization:", error);
    res.status(500).json({ error: error.message || "Failed to prioritize task" });
  }
});

// AI Daily Schedule Generator Endpoint
app.post("/api/generate-schedule", async (req, res) => {
  try {
    const { tasks, calendarEvents, targetDate, clientDate, clientTime } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "A list of tasks is required" });
    }

    const ai = getGeminiClient();

    const prompt = `
      You are TaskPilot AI, an elite daily scheduling assistant.
      Your task is to organize the user's day for target date: ${targetDate || new Date().toISOString().split("T")[0]}.
      
      User's current local date is: ${clientDate || "not provided"}
      User's current local time is: ${clientTime || "not provided"}

      Generate a realistic, high-impact schedule that balances task execution, existing commitments, and prevents burnout.

      Active Tasks to Schedule:
      ${JSON.stringify(
        tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          durationMinutes: t.durationMinutes || 45,
          priority: t.priority,
          riskScore: t.riskScore || 0,
          deadline: t.deadline,
          preferredStartTime: t.preferredStartTime || "any",
        })),
        null,
        2
      )}

      Existing Google Calendar Events (Do NOT schedule tasks over these times):
      ${JSON.stringify(
        (calendarEvents || []).map((e: any) => ({
          title: e.summary || e.title,
          start: e.start?.dateTime || e.start?.date || e.startTime,
          end: e.end?.dateTime || e.end?.date || e.endTime,
        })),
        null,
        2
      )}

      Guidelines:
      1. Determine the baseline start time of the schedule:
         - If the planning date (${targetDate}) matches the user's current local date (${clientDate}), the first task or activity in the schedule MUST start AT or after the user's current local time (${clientTime}). Do NOT schedule any tasks in the past (before ${clientTime}).
         - If the planning date is a future date, start the schedule at 09:00 AM.
      2. Block out slots for high-priority or urgent tasks first, ideally when energy is highest (or as soon as possible if starting in the middle/late of the day).
      3. Account for existing Google Calendar events. Show them in the output as type 'calendar_event'.
      4. Insert standard 'break' or 'buffer' slots (e.g. lunch if around 12:00 PM, short 15-min breather between intensive tasks) to maintain peak performance. Only schedule lunch if the active planning period spans 12:00 PM.
      5. Keep the schedule compact and actionable.
      6. Provide a concise, highly motivating "aiSummary" coaching message that highlights the day's theme.
      7. Strictly respect each task's 'preferredStartTime' relative to the start of the schedule or current time.
         - 'now': Place it at the very start of the schedule (at ${clientTime} if planning for today).
         - '30m': Schedule it approximately 30 minutes after the start of the schedule.
         - '1h': Schedule it approximately 1 hour after the start of the schedule.
         - '2h': Schedule it approximately 2 hours after the start of the schedule.
         - '4h': Schedule it approximately 4 hours after the start of the schedule.
         - 'tomorrow': Schedule it for tomorrow (or at the end of the day if appropriate).
         - 'any': Schedule anytime.
    `;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction: "You are TaskPilot AI, an elite scheduling engine that generates optimized daily schedules. You structure time-slots realistically to maximize focus and minimize context-switching.",
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiSummary: {
              type: Type.STRING,
              description: "An encouraging, motivating and strategic summary of the day's game plan.",
            },
            timeSlots: {
              type: Type.ARRAY,
              description: "Array of daily schedule items ordered chronologically.",
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime: {
                    type: Type.STRING,
                    description: "Start time of the slot in HH:MM format (e.g., '09:00').",
                  },
                  endTime: {
                    type: Type.STRING,
                    description: "End time of the slot in HH:MM format (e.g., '10:15').",
                  },
                  type: {
                    type: Type.STRING,
                    enum: ["task", "calendar_event", "break", "buffer"],
                    description: "The type of the scheduled slot.",
                  },
                  taskId: {
                    type: Type.STRING,
                    description: "The id of the task being scheduled (if type is 'task'). Include this accurately.",
                  },
                  title: {
                    type: Type.STRING,
                    description: "The name of the task, calendar event, break, or buffer.",
                  },
                  notes: {
                    type: Type.STRING,
                    description: "Proactive AI tip or coaching reminder for this specific slot (1 sentence).",
                  },
                },
                required: ["startTime", "endTime", "type", "title"],
              },
            },
          },
          required: ["aiSummary", "timeSlots"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini");
    }

    const scheduleData = JSON.parse(resultText);
    res.json(scheduleData);
  } catch (error: any) {
    console.error("Error in AI Schedule generation:", error);
    res.status(500).json({ error: error.message || "Failed to generate schedule" });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
