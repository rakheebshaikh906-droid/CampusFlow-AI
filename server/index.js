
const express = require("express");
const cors = require("cors");
const tools = require("./tools.js");
const { z } = require("zod");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/state", (req, res) => {
    res.json({
        tasks: tools.listTasks(),
        timer: tools.getTimer(),
    });
});


app.post("/api/command", async (req, res) => {
    const command = String(req.body.command || "").trim();

    if (!command) {
        return res.status(400).json({
            message: "Please enter a command.",
        });
    }

    const lower = command.toLowerCase();

    try {
        let toolResult;
        let message;

        // Add a developer task
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
            lower === "show tasks" ||
            lower === "list tasks" ||
            lower === "show my tasks"
        ) {
            toolResult = await callMcpTool("list_tasks");
            message = "Your task list has been retrieved.";
        }

        // Complete a task by matching its title
        else if (
            lower.startsWith("complete ") ||
            lower.startsWith("finish task ")
        ) {
            const title = command.replace(
                /^(?:complete|finish task)\s+/i,
                ""
            ).trim();

            const listResult = await callMcpTool("list_tasks");
            const allTasks = getToolResult(listResult);

            const match = Array.isArray(allTasks)
                ? allTasks.find(
                    (task) =>
                        !task.completed &&
                        task.title.toLowerCase() === title.toLowerCase()
                )
                : null;

            if (!match) {
                return res.status(404).json({
                    message: `Pending task not found: ${title}`,
                });
            }

            toolResult = await callMcpTool("complete_task", {
                id: match.id,
            });

            message = `Completed: ${match.title}`;
        }

        // Start a focus timer
        else if (
            lower.includes("timer") &&
            (lower.includes("start") || lower.includes("begin"))
        ) {
            const match = lower.match(/(\d+)\s*(?:minutes?|mins?)/);
            const minutes = match ? Number(match[1]) : 25;

            toolResult = await callMcpTool("start_timer", {
                minutes,
            });

            message = `Focus timer started for ${minutes} minutes.`;
        }

        else {
            return res.json({
                message:
                    'Try "Add task: Fix binary search", "Show tasks", "Complete Fix binary search", or "Start 25 minute timer".',
            });
        }

        const stateResponse = await fetch(
            "http://localhost:3001/api/state"
        );
        const state = await stateResponse.json();

        return res.json({
            message,
            toolResult: getToolResult(toolResult),
            tasks: state.tasks,
            timer: state.timer,
            execution: "mcp",
        });
    } catch (error) {
        console.error("Command/MCP error:", error);

        return res.status(502).json({
            message: "MCP action failed. Check the backend logs.",
        });
    }
});




app.post("/api/sprint-plan", async (req, res) => {
    try {
        const goals = Array.isArray(req.body.goals)
            ? req.body.goals
                .map((goal) => String(goal).trim())
                .filter(Boolean)
                .slice(0, 5)
            : [];

        const minutes = Number(req.body.minutes);

        if (goals.length === 0) {
            return res.status(400).json({
                message: "Add at least one developer task."
            });
        }

        if (!Number.isInteger(minutes) || minutes < 15 || minutes > 240) {
            return res.status(400).json({
                message: "Available time must be 15–240 minutes."
            });
        }

        const usableMinutes = Math.floor(minutes * 0.9);
        const base = Math.floor(usableMinutes / goals.length);
        const remainder = usableMinutes % goals.length;
        const schedule = goals.map((goal, index) => ({
            title: goal,
            minutes: base + (index < remainder ? 1 : 0),
            order: index + 1
        }));

        const createdTasks = [];

        for (const item of schedule) {
            const result = await callMcpTool("add_task", {
                title: `[Sprint] ${item.title}`,
                deadline: "Today",
                priority: "High"
            });

            createdTasks.push({
                ...item,
                task: getToolResult(result)
            });
        }

        res.json({
            message: "Developer sprint planned and tasks created through MCP.",
            availableMinutes: minutes,
            plannedMinutes: usableMinutes,
            bufferMinutes: minutes - usableMinutes,
            schedule: createdTasks,
            execution: "mcp"
        });
    } catch (error) {
        console.error("Sprint planner error:", error);
        res.status(502).json({
            message: "Sprint creation failed. Check MCP server and backend logs."
        });
    }
});
app.get("/api/insights", async (req, res) => {
    try {
        const prioritizedTasks = await callMcpTool("prioritize_tasks");
        const nextAction = await callMcpTool("get_next_action");

        res.json({
            success: true,
            prioritizedTasks,
            nextAction,
        });
    } catch (error) {
        console.error("Insights error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});


async function startServer() {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const {
        StreamableHTTPServerTransport,
    } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");

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
                description: "Create a student task",
                inputSchema: {
                    title: z.string().min(1),
                    deadline: z.string().optional(),
                    priority: z.enum(["Low", "Medium", "High"]).optional(),
                },
            },
            async (args) => ({
                content: [{
                    type: "text",
                    text: JSON.stringify(tools.addTask(args)),
                }],
            })
        );

        mcp.registerTool(
            "list_tasks",
            {
                description: "List all student tasks",
                inputSchema: {},
            },
            async () => ({
                content: [{
                    type: "text",
                    text: JSON.stringify(tools.listTasks()),
                }],
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
            async (args) => ({
                content: [{
                    type: "text",
                    text: JSON.stringify(tools.completeTask(args)),
                }],
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
                content: [{
                    type: "text",
                    text: JSON.stringify(tools.startTimer(args)),
                }],
            })
        );

        mcp.registerTool(
            "prioritize_tasks",
            {
                description: "Rank pending tasks by priority, deadline urgency, and task type",
                inputSchema: {},
            },
            async () => ({
                content: [{
                    type: "text",
                    text: JSON.stringify(tools.prioritizeTasks()),
                }],
            })
        );

        mcp.registerTool(
            "get_next_action",
            {
                description: "Recommend the next best pending developer task and explain why",
                inputSchema: {},
            },
            async () => ({
                content: [{
                    type: "text",
                    text: JSON.stringify(tools.getNextAction()),
                }],
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
            console.error("MCP error:", error);

            if (!res.headersSent) {
                res.status(500).json({ error: "MCP request failed" });
            }
        }
    });

    app.listen(3001, () => {
        console.log("CampusFlow API: http://localhost:3001");
        console.log("MCP endpoint: http://localhost:3001/mcp");
    });
}

startServer().catch(console.error);


async function callMcpTool(name, args = {}) {
    const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
    );

    const { StreamableHTTPClientTransport } = await import(
        "@modelcontextprotocol/sdk/client/streamableHttp.js"
    );

    const client = new Client({
        name: "campusflow-web-client",
        version: "1.0.0",
    });

    const transport = new StreamableHTTPClientTransport(
        new URL("http://localhost:3001/mcp")
    );

    try {
        await client.connect(transport);

        const result = await client.callTool({
            name,
            arguments: args,
        });

        if (result.isError) {
            throw new Error(
                result.content
                    ?.filter((item) => item.type === "text")
                    .map((item) => item.text)
                    .join("\n") || "MCP tool failed"
            );
        }

        return result;
    } finally {
        await client.close();
    }
}

function getToolResult(result) {
    const text = result.content
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

