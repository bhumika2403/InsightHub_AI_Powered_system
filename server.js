const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Data file path
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    tasks: [],
    stats: { summaries: 0, tasks: 0, ideas: 0, sentiments: 0, chats: 0 },
    users: []
  }, null, 2));
}

// Helper function to read data
function readData() {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

// Helper function to write data
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ========== API ENDPOINTS ==========

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running!' });
});

// Get all tasks
app.get('/api/tasks', (req, res) => {
  const data = readData();
  res.json({ success: true, tasks: data.tasks });
});

// Add a new task
app.post('/api/tasks', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, message: 'Task text is required' });
  }
  
  const data = readData();
  const newTask = {
    id: Date.now(),
    text: text,
    done: false,
    createdAt: new Date().toISOString()
  };
  
  data.tasks.push(newTask);
  writeData(data);
  
  res.json({ success: true, task: newTask });
});

// Update task (mark as done)
app.put('/api/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const { done } = req.body;
  
  const data = readData();
  const task = data.tasks.find(t => t.id === taskId);
  
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }
  
  task.done = done;
  writeData(data);
  
  res.json({ success: true, task });
});

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  
  const data = readData();
  const index = data.tasks.findIndex(t => t.id === taskId);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }
  
  data.tasks.splice(index, 1);
  writeData(data);
  
  res.json({ success: true, message: 'Task deleted' });
});

// Get stats
app.get('/api/stats', (req, res) => {
  const data = readData();
  res.json({ success: true, stats: data.stats });
});

// Update stats
app.post('/api/stats', (req, res) => {
  const { type } = req.body;
  
  const data = readData();
  
  if (type === 'summary') data.stats.summaries++;
  else if (type === 'task') data.stats.tasks++;
  else if (type === 'idea') data.stats.ideas++;
  else if (type === 'sentiment') data.stats.sentiments++;
  else if (type === 'chat') data.stats.chats++;
  
  writeData(data);
  
  res.json({ success: true, stats: data.stats });
});

// Mock AI endpoint (summary)
app.post('/api/ai/summarize', (req, res) => {
  const { text } = req.body;
  
  // Simple mock summarization
  const sentences = text.replace(/\n/g,' ').split(/[.?!]\s+/).filter(Boolean);
  const summary = sentences.length ? sentences.slice(0, 3) : ['No text provided.'];
  
  res.json({ success: true, summary });
});

// Mock AI endpoint (sentiment)
app.post('/api/ai/sentiment', (req, res) => {
  const { text } = req.body;
  const lowerText = (text || '').toLowerCase();
  
  const positiveWords = ['good', 'great', 'happy', 'love', 'excellent', 'amazing', 'wonderful'];
  const negativeWords = ['bad', 'sad', 'angry', 'hate', 'problem', 'terrible', 'awful'];
  
  const hasPositive = positiveWords.some(w => lowerText.includes(w));
  const hasNegative = negativeWords.some(w => lowerText.includes(w));
  
  let score = 0.5;
  let label = 'Neutral';
  
  if (hasPositive) {
    score = 0.82;
    label = 'Positive';
  } else if (hasNegative) {
    score = 0.18;
    label = 'Negative';
  }
  
  res.json({ success: true, score, label });
});

// Mock AI endpoint (extract tasks)
app.post('/api/ai/tasks', (req, res) => {
  const { text } = req.body;
  
  const sentences = text.replace(/\n/g,' ').split(/[.?!]\s+/).filter(Boolean);
  const tasks = sentences.filter(sent => 
    /^(please|call|email|schedule|prepare|create|build|setup|do|make)/i.test(sent) || 
    /(?:todo|task|action item)/i.test(sent)
  );
  
  const result = tasks.length ? tasks : sentences.slice(0, 4);
  
  res.json({ success: true, tasks: result });
});

// Mock AI endpoint (generate ideas)
app.post('/api/ai/ideas', (req, res) => {
  const { topic } = req.body;
  
  const ideas = [
    `Write a short newsletter about ${topic} with 3 tips.`,
    `Create a 60s video explaining ${topic} key concepts.`,
    `Draft a "beginner checklist" for ${topic}.`,
    `Design an infographic about ${topic} trends.`
  ];
  
  res.json({ success: true, ideas });
});

// User registration (simple mock)
app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }
  
  const data = readData();
  
  // Check if user exists
  const userExists = data.users.find(u => u.email === email);
  if (userExists) {
    return res.status(400).json({ success: false, message: 'User already exists' });
  }
  
  const newUser = {
    id: Date.now(),
    email,
    password, // In production, hash this!
    createdAt: new Date().toISOString()
  };
  
  data.users.push(newUser);
  writeData(data);
  
  res.json({ 
    success: true, 
    user: { id: newUser.id, email: newUser.email }
  });
});

// User login (simple mock)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const data = readData();
  const user = data.users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  
  res.json({ 
    success: true, 
    user: { id: user.id, email: user.email }
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/health`);
});




