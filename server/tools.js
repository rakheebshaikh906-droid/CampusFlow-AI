const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return { tasks: [], nextId: 1 };
        const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        const maxId = tasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0);
        return {
            tasks,
            nextId: Number.isInteger(data.nextId) && data.nextId > maxId
                ? data.nextId
                : maxId + 1,
        };
    } catch (error) {
        console.error("Could not load saved tasks:", error.message);
        return { tasks: [], nextId: 1 };
    }
}

const savedData = loadData();
const tasks = savedData.tasks;
let nextId = savedData.nextId;

function saveData() {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify({ tasks, nextId }, null, 2), "utf8");
    fs.renameSync(tempFile, DATA_FILE);
}

let timer = { running: false, duration: 25 * 60, startedAt: null };

function normalizePriority(priority) {
    const value = String(priority || "Medium").toLowerCase();
    if (value === "high") return "High";
    if (value === "low") return "Low";
    return "Medium";
}

function addTask({ title, deadline = "No deadline", priority = "Medium" }) {
    if (typeof title !== "string" || !title.trim()) {
        throw new Error("Task title is required");
    }

    const task = {
        id: nextId++,
        title: title.trim(),
        deadline: String(deadline || "No deadline").trim(),
        priority: normalizePriority(priority),
        completed: false,
        createdAt: new Date().toISOString(),
    };

    tasks.push(task);
    saveData();
    return task;
}

function listTasks() {
    return tasks.map((task) => ({ ...task }));
}

function completeTask({ id }) {
    const task = tasks.find((item) => item.id === Number(id));
    if (!task) throw new Error("Task not found");
    task.completed = true;
    task.completedAt = new Date().toISOString();
    saveData();
    return { ...task };
}

function deleteTask({ id }) {
    const index = tasks.findIndex((item) => item.id === Number(id));
    if (index === -1) throw new Error("Task not found");
    const [deletedTask] = tasks.splice(index, 1);
    saveData();
    return { ...deletedTask };
}

function startTimer({ minutes = 25 } = {}) {
    const durationMinutes = Number(minutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
        throw new Error("Timer must be between 1 and 180 minutes");
    }

    timer = {
        running: true,
        duration: durationMinutes * 60,
        startedAt: Date.now(),
    };
    return { running: true, minutes: durationMinutes };
}

function getTimer() {
    if (!timer.running || !timer.startedAt) {
        return { running: false, remainingSeconds: 0 };
    }

    const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
    const remainingSeconds = Math.max(0, timer.duration - elapsed);
    if (remainingSeconds === 0) timer.running = false;

    return { running: timer.running, remainingSeconds };
}

function deadlineUrgency(deadline) {
    const value = String(deadline || "").trim().toLowerCase();
    if (!value || value === "no deadline" || value === "none") {
        return { points: 0, label: "No deadline set" };
    }
    if (["today", "tonight", "eod", "end of day"].some((term) => value.includes(term))) {
        return { points: 30, label: "Due today" };
    }
    if (value === "tomorrow" || value.includes("tomorrow")) {
        return { points: 20, label: "Due tomorrow" };
    }

    const date = new Date(deadline);
    if (!Number.isNaN(date.getTime())) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const days = Math.ceil((due - today) / 86400000);
        if (days < 0) return { points: 35, label: "Overdue" };
        if (days === 0) return { points: 30, label: "Due today" };
        if (days === 1) return { points: 20, label: "Due tomorrow" };
        if (days <= 3) return { points: 12, label: `Due in ${days} days` };
        if (days <= 7) return { points: 6, label: `Due in ${days} days` };
    }

    if (value.includes("week")) return { points: 5, label: "Due this week" };
    return { points: 0, label: `Deadline: ${deadline}` };
}

function taskType(title) {
    const text = String(title || "").toLowerCase();
    if (/\b(bug|fix|error|broken|crash|blocker|debug)\b/.test(text)) {
        return { category: "Project blocker", points: 15 };
    }
    if (/\b(interview|exam|assessment|submission|submit|deadline|application)\b/.test(text)) {
        return { category: "Time-sensitive work", points: 12 };
    }
    if (/\b(dsa|leetcode|algorithm|binary search|dynamic programming|practice|study|learn)\b/.test(text)) {
        return { category: "Learning / DSA", points: 7 };
    }
    return { category: "General task", points: 3 };
}

function scoreTask(task) {
    const priority = normalizePriority(task.priority);
    const priorityPoints = priority === "High" ? 30 : priority === "Medium" ? 18 : 8;
    const urgency = deadlineUrgency(task.deadline);
    const type = taskType(task.title);
    const ageHours = Math.max(0, (Date.now() - new Date(task.createdAt || Date.now()).getTime()) / 3600000);
    const agePoints = Math.min(10, Math.floor(ageHours / 24) * 2);
    const score = priorityPoints + urgency.points + type.points + agePoints;

    const reasons = [];
    if (priority === "High") reasons.push("marked high priority");
    if (urgency.points > 0) reasons.push(urgency.label.toLowerCase());
    if (type.category === "Project blocker") reasons.push("looks like a project blocker");
    else if (type.category === "Time-sensitive work") reasons.push("appears time-sensitive");
    else if (type.category === "Learning / DSA") reasons.push("supports learning or DSA practice");
    if (agePoints > 0) reasons.push("has been waiting");

    return {
        ...task,
        priority,
        score,
        category: type.category,
        urgency: urgency.label,
        reason: reasons.length ? `Prioritized because it is ${reasons.join(", ")}.` : "No urgent signals detected; use it as a steady next step.",
    };
}

function prioritizeTasks() {
    return tasks
        .filter((task) => !task.completed)
        .map(scoreTask)
        .sort((a, b) => b.score - a.score || a.id - b.id)
        .map((task, index) => ({ ...task, rank: index + 1 }));
}

function getNextAction() {
    const ranked = prioritizeTasks();
    if (!ranked.length) {
        return {
            hasPendingTasks: false,
            title: "You're clear to plan your next goal.",
            explanation: "There are no pending tasks. Add a coding goal or create a sprint to get started.",
            recommendedMinutes: 25,
            task: null,
        };
    }

    const task = ranked[0];
    const recommendedMinutes = task.category === "Learning / DSA" ? 30 : 25;
    return {
        hasPendingTasks: true,
        title: `Start with: ${task.title}`,
        explanation: task.reason,
        recommendedMinutes,
        task,
    };
}

function handleCommand(text) {
    const input = String(text || "").trim();
    const lower = input.toLowerCase();
    if (!input) return { message: "Type a command first." };

    if ((lower.includes("show") || lower.includes("list")) && lower.includes("task")) {
        const pending = tasks.filter((task) => !task.completed).length;
        return { message: `You have ${pending} pending tasks.`, tasks: listTasks() };
    }

    if (lower.includes("complete") || lower.includes("finish task")) {
        const title = input.replace(/^(?:complete|finish task)\s+/i, "").trim();
        const task = tasks.find((item) => !item.completed && item.title.toLowerCase() === title.toLowerCase());
        if (!task) return { message: "I couldn't find that pending task. Try its exact title." };
        const completedTask = completeTask({ id: task.id });
        return { message: `Completed: ${completedTask.title}`, tasks: listTasks() };
    }

    if (lower.includes("start") && lower.includes("timer")) {
        const match = lower.match(/(\d+)\s*(?:minutes?|mins?)/);
        const minutes = match ? Number(match[1]) : 25;
        const result = startTimer({ minutes });
        return { message: `Focus timer started for ${minutes} minutes.`, timer: result };
    }

    if (/^(?:add|create)(?: coding)? task\b/i.test(input) || lower.startsWith("remind me to")) {
        const title = input
            .replace(/^(?:add|create)(?: coding)? task\s*:?\s*/i, "")
            .replace(/^remind me to\s*/i, "")
            .trim();
        if (!title) return { message: "Tell me the task title, too." };
        const task = addTask({ title });
        return { message: `Task added: ${task.title}`, task, tasks: listTasks() };
    }

    if (lower.includes("what should i do") || lower.includes("next task") || lower.includes("next action")) {
        const next = getNextAction();
        return { message: next.title, recommendation: next };
    }

    return {
        message: 'Try: "Add task: Practice DSA", "Show tasks", "Complete Practice DSA", "What should I do next?", or "Start 25 minute timer".',
    };
}

module.exports = {
    addTask,
    listTasks,
    completeTask,
    deleteTask,
    startTimer,
    getTimer,
    handleCommand,
    prioritizeTasks,
    getNextAction,
};
