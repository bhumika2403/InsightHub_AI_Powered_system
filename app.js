
/* ---------- Helpers ---------- */
const el = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Backend API URL
const API_URL = 'https://insighthub-ai-powered-system-2.onrender.com/api';

/* ---------- State ---------- */
const STATE = {
  stats: {summaries: 0, tasks: 0, ideas: 0, sentiments: 0, chats: 0},
  tasks: [],
  prefs: {theme: 'dark', accent: '#4de0c6'},
  user: null
};

/* ---------- API Calls ---------- */
async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Network error' };
  }
}

/* ---------- Load data from backend ---------- */
async function loadData() {
  const tasksRes = await apiCall('/tasks');
  if (tasksRes.success) {
    STATE.tasks = tasksRes.tasks;
    renderTaskList();
  }
  
  const statsRes = await apiCall('/stats');
  if (statsRes.success) {
    STATE.stats = statsRes.stats;
    updateStatsUI();
    updateChart();
  }
}

/* ---------- Prefs (apply & persist) ---------- */
function applyPrefs() {
  if (STATE.prefs.accent) document.documentElement.style.setProperty('--accent', STATE.prefs.accent);
  if (STATE.prefs.theme === 'light') document.documentElement.classList.add('light-mode'); 
  else document.documentElement.classList.remove('light-mode');
  if (el('accentPicker') && STATE.prefs.accent) el('accentPicker').value = STATE.prefs.accent;
}
applyPrefs();
function savePrefs() { applyPrefs(); }

/* ---------- Stats helpers ---------- */
async function saveStats(type) { 
  await apiCall('/stats', 'POST', { type });
  const statsRes = await apiCall('/stats');
  if (statsRes.success) {
    STATE.stats = statsRes.stats;
    updateStatsUI();
    updateChart();
  }
}

function updateStatsUI() { 
  el('statsSummary').textContent = `Summaries: ${STATE.stats.summaries||0} • Tasks: ${STATE.stats.tasks||0} • Ideas: ${STATE.stats.ideas||0}`; 
}

/* ---------- Chart ---------- */
const chartCtx = document.getElementById('chart1')?.getContext('2d');
const activityChart = chartCtx ? new Chart(chartCtx, {
  type: 'line',
  data: { 
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], 
    datasets:[{
      label:'Activity',
      data:[2,3,4,3,5,6,(STATE.stats.summaries||0)+(STATE.stats.tasks||0)+(STATE.stats.ideas||0)],
      tension:0.35,
      fill:true,
      borderColor: '#4de0c6',
      backgroundColor: 'rgba(77,224,198,0.1)'
    }] 
  },
  options: { 
    plugins:{legend:{display:false}}, 
    scales:{y:{beginAtZero:true}}
  }
}) : null;

function updateChart() { 
  if(activityChart) { 
    activityChart.data.datasets[0].data[6] = (STATE.stats.summaries||0)+(STATE.stats.tasks||0)+(STATE.stats.ideas||0); 
    activityChart.update(); 
  } 
}

/* ---------- Summary widget ---------- */
el('summarizeBtn').addEventListener('click', async () => {
  const txt = el('summaryInput').value.trim();
  el('summaryOutput').innerHTML = `<div class="muted">Generating summary…</div>`;
  
  const result = await apiCall('/ai/summarize', 'POST', { text: txt });
  
  if (result.success) {
    el('summaryOutput').innerHTML = `<ol>${result.summary.map(i=>`<li>${i}</li>`).join('')}</ol>`;
    await saveStats('summary');
  } else {
    el('summaryOutput').innerHTML = `<div class="muted">Error connecting to server</div>`;
  }
});

/* ---------- Sentiment widget ---------- */
el('sentAnalyze').addEventListener('click', async () => {
  const txt = el('sentInput').value.trim();
  el('sentLabel').textContent = 'Analyzing…'; el('sentEmoji').textContent = '⏳';
  
  const result = await apiCall('/ai/sentiment', 'POST', { text: txt });
  
  if (result.success) {
    el('sentLabel').textContent = result.label;
    el('sentEmoji').textContent = result.label === 'Positive' ? '😊' : (result.label === 'Negative' ? '☹️' : '😐');
    el('sentProgress').style.width = `${Math.round((result.score||0.5)*100)}%`;
    await saveStats('sentiment');
  } else {
    el('sentLabel').textContent = 'Error';
  }
});

/* ---------- Tasks ---------- */
function renderTaskList() {
  const container = el('taskList'); container.innerHTML = '';
  STATE.tasks.forEach((t) => {
    const div = document.createElement('div'); div.className = 'taskItem';
    div.innerHTML = `<div class="left"><input type="checkbox" data-id="${t.id}" class="taskCheck" ${t.done?'checked':''} /> <div>${t.text}</div></div>
                     <div><button class="small btn ghost" data-remove="${t.id}">Remove</button></div>`;
    container.appendChild(div);
  });
  
  const q = el('quickTasks'); 
  if(q){ 
    q.innerHTML=''; 
    STATE.tasks.slice(0,5).forEach((t)=> q.insertAdjacentHTML('beforeend', `<div class="taskItem"><div>${t.text}</div><div><button class="small btn ghost" data-quick-remove="${t.id}">Done</button></div></div>`)); 
  }
}

el('extractTasks').addEventListener('click', async () => {
  const txt = el('taskInput').value.trim();
  el('taskList').innerHTML = `<div class="muted">Extracting…</div>`;
  
  const result = await apiCall('/ai/tasks', 'POST', { text: txt });
  
  if (result.success) {
    // Add each extracted task to backend
    for (const taskText of result.tasks) {
      await apiCall('/tasks', 'POST', { text: taskText });
    }
    
    // Reload tasks from backend
    await loadData();
    await saveStats('task');
  } else {
    renderTaskList();
  }
});

document.addEventListener('click', async (ev) => {
  // Remove task
  if (ev.target && ev.target.matches('[data-remove]')) {
    const taskId = Number(ev.target.getAttribute('data-remove'));
    await apiCall(`/tasks/${taskId}`, 'DELETE');
    await loadData();
  }
  
  // Quick remove task
  if (ev.target && ev.target.matches('[data-quick-remove]')) {
    const taskId = Number(ev.target.getAttribute('data-quick-remove'));
    await apiCall(`/tasks/${taskId}`, 'DELETE');
    await loadData();
  }
  
  // Toggle task done
  if (ev.target && ev.target.matches('.taskCheck')) {
    const taskId = Number(ev.target.getAttribute('data-id'));
    const done = ev.target.checked;
    await apiCall(`/tasks/${taskId}`, 'PUT', { done });
    await loadData();
  }
});

el('addQuick').addEventListener('click', async () => {
  const v = el('quickTaskInput').value.trim(); 
  if (!v) return;
  
  await apiCall('/tasks', 'POST', { text: v });
  el('quickTaskInput').value = '';
  await loadData();
});

/* ---------- Ideas ---------- */
el('genIdeas').addEventListener('click', async () => {
  const topic = el('ideaTopic').value.trim();
  if (!topic) { el('ideaOutput').innerHTML = `<div class="muted">Add a topic</div>`; return; }
  
  el('ideaOutput').innerHTML = `<div class="muted">Generating…</div>`;
  
  const result = await apiCall('/ai/ideas', 'POST', { topic });
  
  if (result.success) {
    el('ideaOutput').innerHTML = result.ideas.map(i => `<div class="ideaCard">${i}</div>`).join('');
    await saveStats('idea');
  }
});

/* ---------- Chat ---------- */
function appendMsg(kind, txt) {
  const d = document.createElement('div'); d.className = `msg ${kind}`; d.textContent = txt; 
  el('messages').appendChild(d); el('messages').scrollTop = el('messages').scrollHeight;
}

el('toggleChat').addEventListener('click', () => {
  const panel = el('chatPanel');
  if (panel.classList.contains('closed')) { 
    panel.classList.remove('closed'); 
    el('toggleChat').textContent = 'Close'; 
  } else { 
    panel.classList.add('closed'); 
    el('toggleChat').textContent = 'Open'; 
  }
});

el('sendChat').addEventListener('click', async () => {
  const txt = el('chatInput').value.trim(); 
  if (!txt) return;
  
  appendMsg('user', txt); 
  el('chatInput').value = '';
  
  // Simple mock response
  appendMsg('ai', `I received: "${txt.slice(0,100)}" - I can help you convert this into tasks or summaries!`);
  await saveStats('chat');
});

/* ---------- Theme & Accent ---------- */
el('toggleTheme').addEventListener('click', () => {
  STATE.prefs.theme = STATE.prefs.theme === 'light' ? 'dark' : 'light';
  savePrefs();
});

el('accentPicker').addEventListener('input', (e) => {
  STATE.prefs.accent = e.target.value; savePrefs();
});

el('savePrefs').addEventListener('click', () => { 
  savePrefs(); 
  alert('Preferences saved in memory'); 
});

el('resetPrefs').addEventListener('click', () => { 
  if (confirm('Reset data?')) { 
    STATE.stats = {summaries: 0, tasks: 0, ideas: 0, sentiments: 0, chats: 0};
    STATE.tasks = [];
    STATE.prefs = {theme: 'dark', accent: '#4de0c6'};
    savePrefs();
    updateStatsUI();
    updateChart();
    renderTaskList();
  } 
});

/* ---------- Auth flow ---------- */
function onAuthChange(user) {
  if (user) {
    el('notLogged').classList.add('hidden'); 
    el('loggedIn').classList.remove('hidden'); 
    el('uname').textContent = user.displayName || user.email;
  } else {
    el('notLogged').classList.remove('hidden'); 
    el('loggedIn').classList.add('hidden');
  }
}

el('openAuth').addEventListener('click', () => { el('authOverlay').classList.remove('hidden'); });
el('closeAuth').addEventListener('click', () => { el('authOverlay').classList.add('hidden'); });
el('authSwitch').addEventListener('click', () => {
  const mode = el('authTitle').textContent === 'Sign In' ? 'Sign Up' : 'Sign In';
  el('authTitle').textContent = mode; 
  el('authPrimary').textContent = mode === 'Sign In' ? 'Sign In' : 'Create Account';
});

el('demoBtn').addEventListener('click', () => { 
  STATE.user = { email: 'demo@local', displayName: 'Demo User' }; 
  onAuthChange(STATE.user); 
  el('authOverlay').classList.add('hidden'); 
});

// Backend auth
el('authPrimary').addEventListener('click', async () => {
  const mode = el('authTitle').textContent === 'Sign In' ? 'login' : 'register';
  const email = el('authEmail').value.trim();
  const pass = el('authPass').value;
  
  const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
  const result = await apiCall(endpoint, 'POST', { email, password: pass });
  
  if (result.success) {
    STATE.user = result.user;
    onAuthChange(STATE.user);
    el('authOverlay').classList.add('hidden');
    alert(`${mode === 'login' ? 'Logged in' : 'Registered'} successfully!`);
  } else {
    alert(result.message || 'Authentication failed');
  }
});

el('signOut').addEventListener('click', () => { 
  STATE.user = null; 
  onAuthChange(null); 
});

/* ---------- Sidebar Navigation ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const sections = {
    dashboardBtn: ['.widgets', '.analyticsRow'],
    projectsBtn: ['#projectsCard'],
    analyticsBtn: ['#analyticsCard'],
    integrationBtn: ['#integrationCard'],
    settingsBtn: ['#settingsCard']
  };

  function showSection(btnId) {
    document.querySelectorAll('.nav .menu button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');

    Object.values(sections).forEach(selectors => {
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
      });
    });

    if (sections[btnId]) {
      sections[btnId].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.style.display = sel === '.widgets' ? 'grid' : 'flex');
      });
    }
  }

  Object.keys(sections).forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => showSection(btnId));
  });

  document.getElementById('projectsCard').innerHTML = `
    <h2>Projects</h2>
    <div style="margin-top:20px">
      <div class="taskItem" style="margin-bottom:10px">
        <div><strong>Project Alpha</strong><div class="muted small">Launch new AI feature</div></div>
        <div class="muted small">Due: Dec 15</div>
      </div>
      <div class="taskItem" style="margin-bottom:10px">
        <div><strong>Project Beta</strong><div class="muted small">Redesign dashboard UI</div></div>
        <div class="muted small">Due: Jan 5</div>
      </div>
      <div class="taskItem">
        <div><strong>Project Gamma</strong><div class="muted small">Mobile app development</div></div>
        <div class="muted small">Due: Feb 20</div>
      </div>
    </div>
  `;

  document.getElementById('analyticsCard').innerHTML = `
    <h2>Analytics</h2>
    <div style="margin-top:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:15px">
      <div class="card" style="padding:15px;text-align:center">
        <div class="muted small">Users this week</div>
        <div style="font-size:32px;font-weight:700;margin-top:8px">42</div>
      </div>
      <div class="card" style="padding:15px;text-align:center">
        <div class="muted small">Tasks completed</div>
        <div style="font-size:32px;font-weight:700;margin-top:8px">17</div>
      </div>
      <div class="card" style="padding:15px;text-align:center">
        <div class="muted small">Ideas generated</div>
        <div style="font-size:32px;font-weight:700;margin-top:8px">9</div>
      </div>
    </div>
  `;

  document.getElementById('integrationCard').innerHTML = `
    <h2>Integrations</h2>
    <div style="margin-top:20px">
      <div class="taskItem" style="margin-bottom:10px">
        <div><strong>Slack</strong><div class="muted small">Team communication</div></div>
        <div style="color:#4de0c6">✅ Connected</div>
      </div>
      <div class="taskItem" style="margin-bottom:10px">
        <div><strong>Google Drive</strong><div class="muted small">Cloud storage</div></div>
        <div style="color:#4de0c6">✅ Connected</div>
      </div>
      <div class="taskItem">
        <div><strong>Notion</strong><div class="muted small">Documentation</div></div>
        <div style="color:#ff9800">⚠️ Not Connected</div>
      </div>
    </div>
  `;

  document.getElementById('settingsCard').innerHTML = `
    <h2>Settings</h2>
    <div style="margin-top:20px">
      <div style="margin-bottom:20px">
        <h4>Theme</h4>
        <div class="muted small">Toggle between Dark and Light mode using the sidebar button</div>
      </div>
      <div style="margin-bottom:20px">
        <h4>Accent Color</h4>
        <div class="muted small">Use the color picker in the sidebar to change accent color</div>
      </div>
      <div>
        <h4>Data</h4>
        <div class="muted small">All data is now stored on the backend server!</div>
      </div>
    </div>
  `;

  showSection('dashboardBtn');
  
  // Load initial data from backend
  loadData();
});

/* ---------- Initial render ---------- */

updateStatsUI(); updateChart(); renderTaskList();
