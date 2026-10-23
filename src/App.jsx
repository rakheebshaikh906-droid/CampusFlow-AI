
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API = "https://campusflow-ai-3n9r.onrender.com";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hey! I'm CampusFlow. Add a task, view your tasks, or start a focus timer.",
    },
  ]);
  const [timer, setTimer] = useState({
    running: false,
    remainingSeconds: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [sprintGoals, setSprintGoals] = useState(
    "Practice binary search\nFix React project bugs"
  );
  const [sprintMinutes, setSprintMinutes] = useState(90);
  const [sprintPlan, setSprintPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/state`);
      if (!response.ok) throw new Error("Backend unavailable");
      const data = await response.json();
      setTasks(data.tasks);
      setTimer(data.timer);
      setError("");
    } catch {
      setError("Backend not connected. Start the server on port 3001.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function sendCommand(value = command) {
    const text = value.trim();
    if (!text || busy) return;

    setCommand("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);

    try {
      const response = await fetch(`${API}/api/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: text }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.message || "Done." },
      ]);

      if (data.tasks) setTasks(data.tasks);
      if (data.timer) setTimer(data.timer);
      await refresh();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${err.message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function createSprintPlan() {
    const goals = sprintGoals
      .split("\n")
      .map((goal) => goal.trim())
      .filter(Boolean);

    if (!goals.length) {
      setPlanError("Enter at least one developer task.");
      return;
    }

    setPlanning(true);
    setPlanError("");
    setSprintPlan(null);

    try {
      const response = await fetch(`${API}/api/sprint-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals,
          minutes: Number(sprintMinutes),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not create sprint.");
      }

      setSprintPlan(data);
      await refresh();
    } catch (error) {
      setPlanError(error.message);
    } finally {
      setPlanning(false);
    }
  }

  async function loadInsights() {
    setInsightsLoading(true);
    setInsightsError("");
    try {
      const response = await fetch(`${API}/api/insights`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not analyze tasks.");
      setInsights(data);
    } catch (err) {
      setInsightsError(err.message || "Could not analyze tasks.");
    } finally {
      setInsightsLoading(false);
    }
  }

  function startVoice() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Voice recognition isn't supported in this browser. Please type your command.",
        },
      ]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      setCommand(spoken);
      sendCommand(spoken);
    };

    recognition.start();
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <h2>CampusFlow</h2>
            <span>PERSONAL AI</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active"><span>▦</span> Overview</div>
        <div className="nav-item"><span>✓</span> My tasks</div>
        <div className="nav-item"><span>◷</span> Focus sessions</div>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <strong>Local assistant</strong>
            <p>No paid API required</p>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
            <h1>Good to see you.</h1>
            <p className="subtitle">Make today count, one task at a time.</p>
          </div>
          <div className="date-chip">
            <span className="status-dot" /> Assistant ready
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}



        <section className="stats-grid">
          <article className="stat-card">
            <span className="stat-icon">◷</span>
            <p>Total tasks</p>
            <h2>{tasks.length}</h2>
            <span className="stat-note">Across your workspace</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon">◎</span>
            <p>Pending</p>
            <h2>{pending}</h2>
            <span className="stat-note">Ready for action</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon">✓</span>
            <p>Completed</p>
            <h2>{completed}</h2>
            <span className="stat-note">Tasks finished</span>
          </article>
        </section>

        <section className="panel sprint-panel">
          <div className="eyebrow">DEVELOPER WORKFLOW</div>
          <h2>Plan your next sprint</h2>
          <p className="subtitle">
            Turn coding goals into an actionable session.
          </p>

          <label className="sprint-label" htmlFor="sprint-goals">
            What do you need to finish?
          </label>

          <textarea
            id="sprint-goals"
            className="sprint-textarea"
            value={sprintGoals}
            onChange={(event) => setSprintGoals(event.target.value)}
            placeholder={"Practice binary search\nFix React project bugs"}
            rows={4}
          />

          <div className="sprint-controls">
            <label htmlFor="sprint-minutes">Available time</label>
            <select
              id="sprint-minutes"
              value={sprintMinutes}
              onChange={(event) => setSprintMinutes(Number(event.target.value))}
            >
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
            </select>

            <button
              className="primary-button"
              onClick={createSprintPlan}
              disabled={planning}
            >
              {planning ? "Creating sprint..." : "Build my sprint →"}
            </button>
          </div>

          {planError && (
            <p className="sprint-error" role="alert">{planError}</p>
          )}

          {sprintPlan && (
            <div className="sprint-results">
              <div className="sprint-success">
                <span className="status-dot" />
                {sprintPlan.message}
              </div>

              <div className="sprint-summary">
                <div>
                  <strong>{sprintPlan.plannedMinutes} min</strong>
                  <span>Planned work</span>
                </div>
                <div>
                  <strong>{sprintPlan.bufferMinutes} min</strong>
                  <span>Time buffer</span>
                </div>
              </div>

              {sprintPlan.schedule.map((item) => (
                <div className="sprint-block" key={item.order}>
                  <div className="sprint-order">{item.order}</div>
                  <div className="sprint-block-info">
                    <strong>{item.title}</strong>
                    <span>{item.minutes} minutes · MCP task created</span>
                  </div>
                </div>
              ))}

              <button
                className="primary-button"
                onClick={() => sendCommand(
                  `Start ${Math.min(180, Math.max(1, sprintPlan.schedule[0]?.minutes || 25))} minute timer`
                )}
              >
                Start first focus block
              </button>
            </div>
          )}
        </section>

        <section className="panel insights-panel">
          <div className="insights-header">
            <div>
              <div className="eyebrow">DEVELOPER INTELLIGENCE</div>
              <h2>What should you work on next?</h2>
              <p className="subtitle">
                Rank pending work using priority, deadlines, and developer-task signals.
              </p>
            </div>
            <button
              className="primary-button insights-button"
              onClick={loadInsights}
              disabled={insightsLoading}
            >
              {insightsLoading ? "Analyzing..." : "Analyze my tasks"}
            </button>
          </div>

          {insightsError && <p className="sprint-error" role="alert">{insightsError}</p>}

          {!insights && !insightsError && (
            <p className="insights-empty">
              Analyze your tasks to get a ranked work list and a clear next action.
            </p>
          )}

          {insights?.nextAction && (
            <div className="next-action-card">
              <div className="next-action-icon">→</div>
              <div className="next-action-copy">
                <span className="eyebrow">RECOMMENDED NEXT ACTION</span>
                <h3>{insights.nextAction.title}</h3>
                <p>{insights.nextAction.explanation}</p>
                {insights.nextAction.task && (
                  <button
                    className="secondary-action"
                    onClick={() => sendCommand(`Start ${insights.nextAction.recommendedMinutes} minute timer`)}
                  >
                    Start {insights.nextAction.recommendedMinutes}-minute focus session
                  </button>
                )}
              </div>
            </div>
          )}

          {Array.isArray(insights?.prioritizedTasks) && insights.prioritizedTasks.length > 0 && (
            <div className="ranked-tasks">
              <h3>Priority queue</h3>
              {insights.prioritizedTasks.slice(0, 5).map((task) => (
                <div className="ranked-task" key={task.id}>
                  <span className="rank-number">{task.rank}</span>
                  <div className="ranked-task-copy">
                    <strong>{task.title}</strong>
                    <span>{task.category} · {task.urgency}</span>
                    <p>{task.reason}</p>
                  </div>
                  <span className={`priority ${String(task.priority).toLowerCase()}`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="content-grid">
          <article className="panel assistant-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">YOUR AI COMPANION</div>
                <h2>Talk to CampusFlow</h2>
              </div>
              <div className="ai-orb">✳</div>
            </div>

            <div className="chat-window">
              {messages.map((message, index) => (
                <div className={`message ${message.role}`} key={index}>
                  <div className="message-avatar">
                    {message.role === "assistant" ? "C" : "Y"}
                  </div>
                  <div className="message-body">
                    <span>{message.role === "assistant" ? "CAMPUSFLOW" : "YOU"}</span>
                    <p>{message.text}</p>
                  </div>
                </div>
              ))}
              {busy && <p className="working">Processing your command...</p>}
            </div>

            <form
              className="command-form"
              onSubmit={(event) => {
                event.preventDefault();
                sendCommand();
              }}
            >
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Ask me to add a task or start a timer..."
                aria-label="Assistant command"
              />
              <button
                className={`voice-button ${listening ? "listening" : ""}`}
                type="button"
                onClick={startVoice}
                title="Use voice"
                aria-label="Use voice"
              >
                {listening ? "●" : "🎙"}
              </button>
              <button className="send-button" disabled={busy || !command.trim()}>
                Send ↗
              </button>
            </form>

            <div className="suggestions">
              <button onClick={() => sendCommand("Add task: Practice DSA")}>+ Add DSA task</button>
              <button onClick={() => sendCommand("Show tasks")}>Show tasks</button>
              <button onClick={() => sendCommand("Start 25 minute timer")}>Start focus</button>
            </div>
          </article>

          <article className="panel focus-panel">
            <div className="eyebrow">STAY IN THE ZONE</div>
            <h2>Focus timer</h2>
            <p className="subtitle">One thing at a time.</p>

            <div className={`timer-ring ${timer.running ? "timer-active" : ""}`}>
              <div>
                <span className="timer-time">
                  {formatTime(timer.remainingSeconds)}
                </span>
                <span className="timer-label">
                  {timer.running ? "SESSION ACTIVE" : "READY TO FOCUS"}
                </span>
              </div>
            </div>

            <div className="timer-state">
              <span className="status-dot" />
              {timer.running ? "Your session is in progress" : "Start a session using the assistant"}
            </div>

            <button
              className="primary-button"
              onClick={() => sendCommand("Start 25 minute timer")}
            >
              Start 25-minute session
            </button>
            <p className="small-note">The timer continues while this page is open.</p>
          </article>
        </section>

        <section className="panel tasks-panel">
          <div className="tasks-heading">
            <div>
              <div className="eyebrow">YOUR WORK, ORGANIZED</div>
              <h2>Today's tasks</h2>
            </div>
            <span className="task-count">{pending} pending</span>
          </div>

          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <h3>A clear space to start</h3>
              <p>Add your first task using the assistant above.</p>
            </div>
          ) : (
            <div className="task-list">
              {tasks.map((task) => (
                <div className={`task-row ${task.completed ? "is-complete" : ""}`} key={task.id}>
                  <div className="task-check">{task.completed ? "✓" : "○"}</div>
                  <div className="task-details">
                    <strong>{task.title}</strong>
                    <span>{task.deadline || "No deadline"} · {task.priority}</span>
                  </div>
                  <span className={`priority ${task.priority.toLowerCase()}`}>
                    {task.priority}
                  </span>
                  {!task.completed && (
                    <button
                      className="complete-button"
                      onClick={() => sendCommand(`Complete ${task.title}`)}
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <footer>CampusFlow AI · Built for the Alexa+ simulated experience track</footer>
      </section>
    </main>
  );
}
