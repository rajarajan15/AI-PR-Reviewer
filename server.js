import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import { spawn } from "child_process";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(express.json());

app.use(bodyParser.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || "ai-pr-reviewer-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory storage (replace with database in production)
const users = new Map();
const reviewHistory = new Map(); // userId -> [reviews]

// Initialize demo user
const demoPasswordHash = await bcrypt.hash("demo123", 10);
users.set("demo@example.com", {
  email: "demo@example.com",
  password: demoPasswordHash,
  name: "Demo User"
});

let chatHistoryStore = []; 

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ---- Authentication endpoints ----
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.userId = email;
  res.json({ 
    success: true, 
    user: { email: user.email, name: user.name }
  });
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body;

  if (users.has(email)) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.set(email, { email, password: hashedPassword, name });
  reviewHistory.set(email, []);

  req.session.userId = email;
  res.json({ 
    success: true, 
    user: { email, name }
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/api/auth/session", (req, res) => {
  if (req.session.userId) {
    const user = users.get(req.session.userId);
    res.json({ 
      authenticated: true, 
      user: { email: user.email, name: user.name }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ---- PR diff fetching ----
async function fetchPRDiff(owner, repo, prNumber) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
  const headers = { Authorization: `token ${process.env.GITHUB_TOKEN}` };
  const res = await fetch(url, { headers });
  const files = await res.json();

  if (!Array.isArray(files)) throw new Error("Failed to fetch PR details.");

  let diffText = "";
  for (const file of files) {
    diffText += `File: ${file.filename}\n${file.patch || "No patch available"}\n\n`;
  }
  return { diffText, files };
}

// ---- Post comment to GitHub PR ----
// This function sends the comment to GitHub
async function postGitHubComment(owner, repo, prNumber, body, lineInfo = null) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('Error: GITHUB_TOKEN is not set in your environment variables.');
    return;
  }

  if (lineInfo) {
    // Inline comment on a specific line of code
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        body,
        commit_id: lineInfo.commitId,
        path: lineInfo.path,
        line: lineInfo.line,
        side: "RIGHT"
      })
    });
    return await res.json();
  } else {
    // General comment on the pull request
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({ body })
    });
    return await res.json();
  }
}

// Immediately-invoked function to post a test comment
(async () => {
  console.log("Posting comment...");

  // 1. Set repo and PR details
  const owner = 'rajarajan15';
  const repo = 'muse-play';
  const prNumber = 1;

  // 2. Comment content
  const commentBody = 'This is a test comment posted from my script! 👍';

  // 3. Call the function
  const result = await postGitHubComment(owner, repo, prNumber, commentBody);
  console.log("from console", result);

  // 4. Log success/failure
  if (result.id) {
    console.log(`✅ Success! Comment posted: ${result.html_url}`);
  } else {
    console.error('❌ Failed to post comment. Response from GitHub:', result);
  }
})();

// ---- Ollama AI function ----
function runOllama(prompt) {
  return new Promise((resolve, reject) => {
    const model = process.env.MODEL || "llama3";
    const ai = spawn("ollama", ["run", model]);
    let output = "";

    ai.stdout.on("data", (data) => (output += data.toString()));
    ai.stderr.on("data", (data) => {
      // Ignore Ollama stderr
    });

    ai.on("close", () => {
      resolve(output);
    });

    ai.on("error", (err) => {
      reject(err);
    });

    ai.stdin.write(prompt);
    ai.stdin.end();
  });
}

// ---- Parse AI response into structured format ----
function parseAIResponse(aiOutput) {
  const sections = {
    summary: '',
    potentialBugs: [],
    suggestions: [],
    testCases: []
  };

  try {
    // Split the output into lines
    const lines = aiOutput.split('\n');
    let currentSection = null;

    for (let line of lines) {
      line = line.trim();
      
      // Detect section headers
      if (line.toUpperCase().includes('SUMMARY:')) {
        currentSection = 'summary';
        // Check if summary is on the same line
        const summaryText = line.substring(line.indexOf(':') + 1).trim();
        if (summaryText) {
          sections.summary = summaryText;
        }
        continue;
      } else if (line.toUpperCase().includes('POTENTIAL BUGS:')) {
        currentSection = 'potentialBugs';
        continue;
      } else if (line.toUpperCase().includes('SUGGESTIONS:')) {
        currentSection = 'suggestions';
        continue;
      } else if (line.toUpperCase().includes('TEST CASES:')) {
        currentSection = 'testCases';
        continue;
      }

      // Skip empty lines
      if (!line) continue;

      // Add content to the appropriate section
      if (currentSection === 'summary' && !sections.summary) {
        sections.summary = line;
      } else if (currentSection === 'summary' && sections.summary) {
        sections.summary += ' ' + line;
      } else if (currentSection === 'potentialBugs' && line.startsWith('-')) {
        sections.potentialBugs.push(line.substring(1).trim());
      } else if (currentSection === 'suggestions' && line.startsWith('-')) {
        sections.suggestions.push(line.substring(1).trim());
      } else if (currentSection === 'testCases' && line.startsWith('-')) {
        sections.testCases.push(line.substring(1).trim());
      }
    }

    // Fallback: if parsing failed, put everything in summary
    if (!sections.summary && !sections.potentialBugs.length && 
        !sections.suggestions.length && !sections.testCases.length) {
      sections.summary = aiOutput.substring(0, 500); // Limit length
    }

  } catch (err) {
    console.error('Error parsing AI response:', err);
    sections.summary = aiOutput.substring(0, 500);
  }

  return sections;
}

// ---- Review endpoint ----
app.post("/api/review", requireAuth, async (req, res) => {
  const { owner, repo, prNumber } = req.body;
  try {
    const { diffText, files } = await fetchPRDiff(owner, repo, prNumber);

    const prompt = `
You are an AI Pull Request Reviewer.
Analyze the following GitHub Pull Request diff and provide a detailed review.

Please structure your response EXACTLY as follows (do not include any JSON formatting, just plain text sections):

SUMMARY:
[Provide a brief summary of the changes in 2-3 sentences]

POTENTIAL BUGS:
- [List each potential bug or logical issue on a new line with a dash]
- [Another potential issue]

SUGGESTIONS:
- [List each suggestion for improvements (performance, style, security) on a new line with a dash]
- [Another suggestion]

TEST CASES:
- [List missing test cases or edge cases on a new line with a dash]
- [Another test case]

Diff:
${diffText}
    `;

    const aiOutput = await runOllama(prompt);
    
    // Parse AI output into structured format
    const reviewData = parseAIResponse(aiOutput);

    // Save to history
    const history = reviewHistory.get(req.session.userId) || [];
    history.unshift({
      id: Date.now(),
      owner,
      repo,
      prNumber,
      review: reviewData,
      timestamp: new Date().toISOString(),
      status: "pending"
    });
    reviewHistory.set(req.session.userId, history.slice(0, 50)); // Keep last 50

    res.json({ review: reviewData, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- History endpoint ----
app.get("/api/history", requireAuth, (req, res) => {
  const history = reviewHistory.get(req.session.userId) || [];
  res.json({ history });
});

// ---- Clear history endpoint ----
app.delete("/api/history", requireAuth, (req, res) => {
  reviewHistory.set(req.session.userId, []);
  res.json({ success: true });
});

// ---- Post feedback to GitHub ----
app.post("/api/feedback", requireAuth, async (req, res) => {
  const { owner, repo, prNumber, comment, action, lineInfo } = req.body;
  
  try {
    let body = comment;
    if (action === "accept") {
      body = `✅ **Accepted**: ${comment}`;
    } else if (action === "reject") {
      body = `❌ **Rejected**: ${comment}`;
    }

    const result = await postGitHubComment(owner, repo, prNumber, body, lineInfo);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, context, history } = req.body;

  if (!message || !context) {
    return res.status(400).json({ error: "Missing message or context" });
  }

  try {
    // Build prompt for the AI model
    const prompt = `
You are an AI assistant for code review.

User message: ${message}

PR Context:
Owner: ${context.owner}
Repo: ${context.repo}
PR Number: ${context.prNumber}
Review content: ${JSON.stringify(context.review, null, 2)}

Previous conversation history:
${history ? JSON.stringify(history, null, 2) : "None"}

Respond concisely and helpfully.
`;

    // Spawn Ollama CLI for AI response
    const ai = spawn("ollama", ["run", "llama3"]);

    let output = "";

    ai.stdout.on("data", (data) => {
      output += data.toString();
    });

    ai.stderr.on("data", (data) => {
      console.error("Ollama error:", data.toString());
    });

    ai.on("close", () => {
      // Save message + AI response to history
      const entry = { user: message, ai: output, context };
      chatHistoryStore.push({ ...entry, timestamp: new Date() });

      res.json({ response: output });
    });

    ai.stdin.write(prompt);
    ai.stdin.end();

  } catch (err) {
    console.error("Error in /api/chat:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// GET /api/history
// ----------------------
app.get("/api/chathistory", (req, res) => {
  res.json({ history: chatHistoryStore });
});

app.listen(5000, () =>
  console.log("✅ Server running on http://localhost:5000")
);