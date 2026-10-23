const express = require("express");
const cors = require("cors");
const tools = require("./tools.js");
const { z } = require("zod");

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const app = express();

const PORT = Number(process.env.PORT) || 3001;
const LOCAL_BASE_URL = `http://127.0.0.1:${PORT}`;

app.use(
    cors({
        origin: process.env.FRONTEND_URL
            ? [
                "http://localhost:5173",
                "http://localhost:5174",
                process.env.FRONTEND_URL,
            ]
            : true,
    })
);

app.use(express.json());

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/health", (req, res) => {
    res.json({
        success: true,
        service: "campusflow-ai-api",
    });
});

// --------------------------------------------------
// HELPER: GET MCP RESULT
// --------------------------------------------------

function getToolResult(result) {
    const text = result?.content
        ?.filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");

    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

// --------------------------------------------------
// MCP CLIENT: CALL TOOL
// --------------------------------------------------

async function callMcpTool(name, args = {}) {
    const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
    );

    const {
        StreamableHTTPClientTransport,
    } = await import(
        "@modelcontextprotocol/sdk/client/streamableHttp.js"
    );

    const client = new Client({
        name: "campusflow-web-client",
        version: "1.0.0",
    });

    const transport = new StreamableHTTPClientTransport(
        new URL(`${LOCAL_BASE_URL}/mcp`)
    );

    try {
        await client.connect(transport);

        const result = await client.callTool({
            name,
            arguments: args,
        });

        if (result.isError) {
            throw new Error(
                getToolResult(result) || `MCP tool failed: ${name}`
            );
        }

        return result;
    } finally {
        await client.close();
    }
}

// --------------------------------------------------
// API: GET CURRENT STATE
// --------------------------------------------------

app.get("/api/state", (req, res) => {
    res.json({
        tasks: tools.listTasks(),
        timer: tools.getTimer(),
    });
});

// --------------------------------------------------
// API: COMMAND ASSISTANT
// --------------------------------------------------

app.post("/api/command", async (req, res) => {
    const command = String(req.body?.command || "").trim();

    if (!command) {
        return res.status(400).json({
            success: false,
            message: "Please enter a command.",
        });
    }

    const lower = command.toLowerCase();

    try {
        let toolResult;
        let message;

        // Add task
        const addMatch = command.match(
            /^(?:add|create)(?: coding)? task\s*:?\s*(.+)$/i
        );

        if (addMatch) {
            const title = addMatch[1].trim();

            toolResult = await callMcpTool("add_task", {
                title,
                priority: "High",
            });

            message = `Task created: ${title}`;
        }

        // List tasks
        else if (
            ["show tasks", "list tasks", "show my tasks"].includes(lower)
        ) {
            toolResult = await callMcpTool("list_tasks");
            message = "Your task list has been retrieved.";
        }

        // Complete task by title
        else if (
            lower.startsWith("complete ") ||
            lower.startsWith("finish task ")
        ) {
            const title = command
                .replace(/^(?:complete|finish task)\s+/i, "")
                .trim();

            const listResult = await callMcpTool("list_tasks");
            const allTasks = getToolResult(listResult);

            const taskList = Array.isArray(allTasks)
                ? allTasks
                : allTasks?.tasks;

            const match = Array.isArray(taskList)
                ? taskList.find(
                    (task) =>
                        !task.completed &&
                        task.title?.toLowerCase() === title.toLowerCase()
                )
                : null;

            if (!match) {
                return res.status(404).json({
                    success: false,
                    message: `Pending task not found: ${title}`,
                });
            }

            toolResult = await callMcpTool("complete_task", {
                id: match.id,
            });

            message = `Completed: ${match.title}`;
        }

        // Start focus timer
        else if (
            lower.includes("timer") &&
            (lower.includes("start") || lower.includes("begin"))
        ) {
            const match = lower.match(/(\d+)\s*(?:minutes?|mins?)/);
            const minutes = match ? Number(match[1]) : 25;

            if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
                return res.status(400).json({
                    success: false,
                    message: "Timer duration must be between 1 and 180 minutes.",
                });
            }

            toolResult = await callMcpTool("start_timer", { minutes });
            message = `Focus timer started for ${minutes} minutes.`;
        }

        // Unsupported command
        else {
            return res.json({
                success: true,
                message:
                    'Try "Add task: Fix binary search", "Show tasks", "Complete Fix binary search", or "Start 25 minute timer".',
            });
        }

        return res.json({
            success: true,
            message,
            toolResult: getToolResult(toolResult),
            tasks: tools.listTasks(),
            timer: tools.getTimer(),
            execution: "mcp",
        });
    } catch (error) {
        console.error("Command/MCP error:", error);

        return res.status(502).json({
            success: false,
            message: "MCP action failed. Check the backend logs.",
        });
    }
});

// --------------------------------------------------
// API: DEVELOPER SPRINT PLANNER
// --------------------------------------------------

app.post("/api/sprint-plan", async (req, res) => {
    try {
        const goals = Array.isArray(req.body?.goals)
            ? req.body.goals
                .map((goal) => String(goal).trim())
                .filter(Boolean)
                .slice(0, 5)
            : [];

        const minutes = Number(req.body?.minutes);

        if (goals.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Add at least one developer task.",
            });
        }

        if (
            !Number.isInteger(minutes) ||
            minutes < 15 ||
            minutes > 240
        ) {
            return res.status(400).json({
                success: false,
                message: "Available time must be 15–240 minutes.",
            });
        }

        const usableMinutes = Math.floor(minutes * 0.9);
        const base = Math.floor(usableMinutes / goals.length);
        const remainder = usableMinutes % goals.length;

        const schedule = goals.map((goal, index) => ({
            title: goal,
            minutes: base + (index < remainder ? 1 : 0),
            order: index + 1,
        }));

        const createdTasks = [];

        for (const item of schedule) {
            const result = await callMcpTool("add_task", {
                title: `[Sprint] ${item.title}`,
                deadline: "Today",
                priority: "High",
            });

            createdTasks.push({
                ...item,
                task: getToolResult(result),
            });
        }

        return res.json({
            success: true,
            message: "Developer sprint planned and tasks created through MCP.",
            availableMinutes: minutes,
            plannedMinutes: usableMinutes,
            bufferMinutes: minutes - usableMinutes,
            schedule: createdTasks,
            execution: "mcp",
        });
    } catch (error) {
        console.error("Sprint planner error:", error);

        return res.status(502).json({
            success: false,
            message: "Sprint creation failed. Check MCP server and backend logs.",
        });
    }
});

// --------------------------------------------------
// API: DEVELOPER INTELLIGENCE
// --------------------------------------------------

app.get("/api/insights", async (req, res) => {
    try {
        const [prioritizedTasks, nextAction] = await Promise.all([
            callMcpTool("prioritize_tasks"),
            callMcpTool("get_next_action"),
        ]);

        return res.json({
            success: true,
            prioritizedTasks: getToolResult(prioritizedTasks),
            nextAction: getToolResult(nextAction),
        });
    } catch (error) {
        console.error("Insights error:", error);

        return res.status(502).json({
            success: false,
            message: "Could not generate insights. Check MCP logs.",
        });
    }
});

// --------------------------------------------------
// MCP SERVER
// --------------------------------------------------

async function startServer() {
    const { McpServer } = await import(
        "@modelcontextprotocol/sdk/server/mcp.js"
    );

    const {
        StreamableHTTPServerTransport,
    } = await import(
        "@modelcontextprotocol/sdk/server/streamableHttp.js"
    );

    app.all("/mcp", async (req, res) => {
        const mcp = new McpServer({
            name: "campusflow-ai",
            version: "1.0.0",
        });

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        mcp.registerTool(
            "add_task",
            {
                description: "Create a developer task",
                inputSchema: {
                    title: z.string().min(1),
                    deadline: z.string().optional(),
                    priority: z.enum(["Low", "Medium", "High"]).optional(),
                },
            },
            async (args) => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tools.addTask(args)),
                    },
                ],
            })
        );

        mcp.registerTool(
            "list_tasks",
            {
                description: "List all developer tasks",
                inputSchema: {},
            },
            async () => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tools.listTasks()),
                    },
                ],
            })
        );

        mcp.registerTool(
            "complete_task",
            {
                description: "Complete a task using its numeric ID",
                inputSchema: {
                    id: z.number().int().positive(),
                },
            },
            async ({ id }) => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tools.completeTask({ id })),
                    },
                ],
            })
        );

        mcp.registerTool(
            "start_timer",
            {
                description: "Start a focus timer",
                inputSchema: {
                    minutes: z.number().int().min(1).max(180).optional(),
                },
            },
            async (args) => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tools.startTimer(args)),
                    },
                ],
            })
        );

        mcp.registerTool(
            "prioritize_tasks",
            {
                description:
                    "Rank pending tasks by priority, deadline urgency, and task type",
                inputSchema: {},
            },
            async () => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tools.prioritizeTasks()),
                    },
                ],
            })
        );

        mcp.registerTool(
            "get_next_action",
            {
                description:
                    "Recommend the next best pending developer task and explain why",
                inputSchema: {},
            },
            async () => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(tools.getNextAction()),
                    },
                ],
            })
        );

        res.on("close", () => {
            transport.close().catch(() => { });
            mcp.close().catch(() => { });
        });

        try {
            await mcp.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error("MCP request error:", error);

            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: "MCP request failed.",
                });
            }
        }
    });

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`CampusFlow API running on port ${PORT}`);
        console.log(`Health check: /health`);
        console.log(`MCP endpoint: /mcp`);
    });
}

startServer().catch((error) => {
    console.error("Failed to start CampusFlow server:", error);
    process.exit(1);
});