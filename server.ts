import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required. Please set it in your environment.');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// 1. Generate Schedule Endpoint
app.post('/api/generate-schedule', async (req, res) => {
  try {
    const { tasks, availableHours, timezone } = req.body;
    const ai = getAI();

    const prompt = `
You are the "Deadline Ninja" scheduler. Given the user's tasks and deadlines, create a personalized hour-by-hour tactical timeline for today.
Available Hours: ${availableHours} hours.
Timezone / Local Time Context: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} (server time).
Tasks:
${JSON.stringify(tasks, null, 2)}

Requirements:
1. Maximize productivity. Dedicate the available hours to highest priority and highest risk tasks.
2. Build in short 5-10 minute rest periods (Pomodoro breaks) or buffer slots.
3. Be realistic about execution times.
4. Output a JSON object with a single key 'schedule' which is an array of items. Each item must have:
   - 'time' (string, e.g. "09:00 - 10:00")
   - 'taskName' (string, name of task or activity)
   - 'duration' (string, e.g. "60 mins")
   - 'type' (string, either "focus" | "break" | "flex" | "review")
   - 'advice' (string, a quick ninja tip/tactic for this slot)

Return ONLY the JSON. No markdown wrappers.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    res.json(JSON.parse(text || '{}'));
  } catch (error: any) {
    console.error('Error generating schedule:', error);
    res.status(500).json({ error: error.message || 'Failed to generate schedule' });
  }
});

// 2. Chat Assistant Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, tasks } = req.body;
    const ai = getAI();

    const systemInstruction = `
You are "Deadline Ninja", an elite productivity companion and mentoring master. 
Your tone is sharp, disciplined, encouraging, and themed with ninja metaphors (e.g. "beat your deadlines", "strike with focus", "the shadow of procrastination").
You are talking to a user to help them beat their deadlines. Use their task list to provide real context.
Tasks list of user:
${JSON.stringify(tasks, null, 2)}

If the user says they couldn't finish their work, or they are behind:
1. Suggest concrete tactical adjustments (e.g. "Let's perform a strategic fallback: postpone low-priority task X, focus completely on high-risk task Y").
2. Give them a quick 3-step action plan.
3. Keep response concise, action-oriented, and highly motivating. No long walls of text. Keep it to 2-3 short paragraphs max.
`;

    // Convert messages to Gemini SDK contents format
    // In @google/genai, chat is built using content parts
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

    // Inject system instructions using config
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: error.message || 'Failed to process chat' });
  }
});

// 3. Risk Prediction Endpoint
app.post('/api/risk-forecast', async (req, res) => {
  try {
    const { tasks, habitStats } = req.body;
    const ai = getAI();

    const prompt = `
Analyze the success likelihood of the following tasks. 
Tasks list:
${JSON.stringify(tasks, null, 2)}

User Habit Context:
${JSON.stringify(habitStats, null, 2)}

Calculate:
1. Success Chance % (0 to 100) for each task.
2. AI Risk Score (0 to 100).
3. Expandable list of specific "Why?" risk factors (e.g., procrastination risk, insufficient hours, proximity of deadline, scope creep).

Return a JSON object containing a key 'forecasts' which is an array of objects. Each object should have:
- 'taskId' (string)
- 'successChance' (number)
- 'riskScore' (number)
- 'riskLevel' (string: "low" | "medium" | "high")
- 'whyFactors' (array of strings)
- 'aiRecommendation' (string)

Return ONLY the JSON. No markdown wrappers.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error in risk forecast:', error);
    res.status(500).json({ error: error.message || 'Failed to predict risk' });
  }
});

// 4. Document / Screenshot scanner Endpoint (Vision)
app.post('/api/scan-document', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const ai = getAI();

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    // Strip out base64 header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `
You are an expert deadline and assignment parser. Scan this screenshot or email content, and automatically extract all upcoming deadlines, meetings, assignments, test dates, and interview dates.
Extract details with extreme accuracy.
Return a JSON object with a single key 'events' containing an array of objects. Each object must have:
- 'name' (string, descriptive title of task/event)
- 'type' (string, e.g., "Assignment" | "Exam" | "Meeting" | "Interview" | "Project")
- 'deadline' (string, formatted as YYYY-MM-DD or close estimate if exact day not clear)
- 'priority' (string, "high" | "medium" | "low" based on severity)
- 'estimatedHours' (number, estimated hours needed to prepare/complete, e.g., 5)

If no events are found, return an empty array for 'events'.
Return ONLY JSON. No markdown wrappers.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/png',
            data: cleanBase64,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error scanning document:', error);
    res.status(500).json({ error: error.message || 'Failed to scan image' });
  }
});

// 5. Weekly Productivity Report
app.post('/api/productivity-report', async (req, res) => {
  try {
    const { tasksHistory, habitStreaks, username } = req.body;
    const ai = getAI();

    const prompt = `
You are the Deadline Ninja Master. Generate a weekly custom productivity review and performance score for user "${username}".
Task completion history:
${JSON.stringify(tasksHistory, null, 2)}

Habit Streaks:
${JSON.stringify(habitStreaks, null, 2)}

Provide:
1. Overall Weekly Performance Grade (A+, B, etc.) and a calculated overall Score (0 to 100).
2. A list of 3 Key Strengths (what went right).
3. A list of 3 Growth Opportunities (what went wrong/procrastination areas).
4. An elite ninja motivational guidance paragraph.

Return a JSON object with fields:
- 'grade' (string)
- 'score' (number)
- 'strengths' (array of strings)
- 'growth' (array of strings)
- 'guidance' (string)

Return ONLY JSON. No markdown wrappers.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error generating productivity report:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
