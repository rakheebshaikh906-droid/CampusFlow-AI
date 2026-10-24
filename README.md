# CampusFlow AI — Your AI-Powered Developer Workspace

**Plan smarter. Prioritize better. Focus deeper.**

CampusFlow AI is a developer productivity workspace built for the **Alexa+ Simulated Experience Hackathon Track**. It combines task management, intelligent task prioritization, developer sprint planning, and focus sessions in a single web application, powered by a Model Context Protocol (MCP) server.

Instead of switching between multiple productivity tools, developers can organize their work, identify their next priority, break coding goals into manageable sessions, and stay focused from one dashboard.

## Live Demo

- **Live Application:** https://campus-flow-ai-fawn.vercel.app/
- **Backend Health Check:** https://campusflow-ai-3n9r.onrender.com/health
- **GitHub Repository:** `https://github.com/rakheebshaikh906-droid/CampusFlow-AI`

## Demo Video

Watch the CampusFlow AI walkthrough to see its features, MCP integration, and end-to-end workflow in action.

**Video Link:** `https://www.youtube.com/watch?v=bYPgJFtiXBQ`

> The demo video will be added here after recording and uploading the walkthrough.

## Features

### 1. Smart Task Management
- Create and organize developer tasks.
- Mark tasks as completed.
- Delete tasks when they are no longer needed.
- Track total, pending, and completed tasks.
- Set task priorities and deadlines where supported.

### 2. Developer Intelligence
- Rank pending tasks using priority, deadline urgency, task category, and task age.
- Identify the next recommended task.
- Display explanations for task prioritization.
- Help developers decide what to work on next.

### 3. Developer Sprint Planner
- Enter coding goals and development tasks.
- Choose the available time for a work session.
- Generate an actionable sprint schedule.
- Automatically create corresponding tasks through MCP.
- Start a focus session for the first planned work block.

### 4. Focus Timer
- Start a focus session using the assistant.
- Select a timer duration between 1 and 180 minutes.
- Track the remaining session time.
- Integrate focus sessions into the developer workflow.

### 5. Conversational Assistant
- Submit commands through the chat interface.
- Add tasks, list tasks, complete tasks, and start timers using supported commands.
- Use browser-based voice input where supported.
- Receive feedback from the assistant when an action succeeds or fails.

### 6. Model Context Protocol (MCP)
CampusFlow AI exposes its productivity capabilities through an MCP server using Streamable HTTP transport.

The MCP architecture separates tool execution from the user interface, making the underlying productivity functions accessible through a standardized tool interface.

## MCP Tools

| Tool | Description |
|---|---|
| `add_task` | Creates a developer task |
| `list_tasks` | Retrieves the current task list |
| `complete_task` | Marks a task as completed |
| `delete_task` | Deletes a task using its numeric ID |
| `start_timer` | Starts a focus timer |
| `prioritize_tasks` | Ranks pending tasks by priority signals |
| `get_next_action` | Recommends the next task to work on |

**MCP Endpoint:** `https://campusflow-ai-3n9r.onrender.com/mcp`

**Transport:** Streamable HTTP

The deployed endpoint and available tools can be tested using the MCP Inspector.

## Architecture

```text
                CampusFlow AI
                      |
          +-----------+-----------+
          |                       |
     React Frontend          User Input
       (Vercel)                  |
          |                      |
          +----------+-----------+
                     |
               REST API Calls
                     |
             Express Backend
               (Render)
                     |
                MCP Client
                     |
              MCP Server
              /mcp endpoint
                     |
              Registered Tools
                     |
        +------------+------------+
        |            |            |
      Tasks      Priorities     Timer
        |
    JSON Storage
```

The frontend communicates with the Express backend through REST endpoints. The backend uses an MCP client to invoke registered MCP tools for supported assistant commands, sprint creation, and developer insights.

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- Browser Speech Recognition API, where supported

### Backend
- Node.js
- Express.js
- CORS
- Model Context Protocol SDK
- Zod for tool input validation

### Protocol and Data
- Model Context Protocol (MCP)
- Streamable HTTP transport
- JSON-based local file storage

### Deployment
- Vercel — frontend hosting
- Render — backend hosting

## Getting Started

### Prerequisites
- Node.js and npm
- Git
- A code editor such as Visual Studio Code

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd CampusFlow-AI
```

Replace the repository URL with your actual GitHub repository URL.

### 2. Install frontend dependencies

From the project root:

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd server
npm install
```

### 4. Configure environment variables

Configure the following variable in the backend environment when deploying:

```env
FRONTEND_URL=https://campus-flow-ai-fawn.vercel.app
```

The backend uses the hosting platform's `PORT` environment variable when available and falls back to port `3001` for local development.

Do not commit secrets, API keys, or private environment files to GitHub.

### 5. Start the backend

From the `server` directory:

```bash
npm start
```

The backend should start on the configured port.

Health check:

```text
http://localhost:3001/health
```

### 6. Start the frontend

Open another terminal in the project root:

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Backend health check |
| `GET` | `/api/state` | Retrieve tasks and timer state |
| `POST` | `/api/command` | Process supported assistant commands |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/sprint-plan` | Generate a developer sprint plan |
| `GET` | `/api/insights` | Retrieve developer insights |
| `GET/POST` | `/mcp` | MCP Streamable HTTP endpoint |

The `/mcp` endpoint also handles the protocol requests required by the MCP SDK. Actual supported methods depend on the MCP transport and protocol interaction.

## Testing MCP Integration

Use the MCP Inspector to test the deployed server.

1. Start the Inspector:

   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. Select **Streamable HTTP** as the transport.
3. Enter the deployed MCP endpoint:

   ```text
   https://campusflow-ai-3n9r.onrender.com/mcp
   ```

4. Connect to the server.
5. Inspect the registered tools.
6. Execute `list_tasks` and `add_task`.
7. Verify the created task using `list_tasks`.
8. Test `complete_task`, `delete_task`, `start_timer`, `prioritize_tasks`, and `get_next_action`.

Always use a disposable test task when testing destructive operations.

## Example Workflow

A typical CampusFlow AI session looks like this:

1. Add a coding task, such as practicing binary search.
2. Analyze pending tasks to identify the highest-priority work.
3. Enter coding goals in the sprint planner.
4. Generate a structured sprint schedule.
5. Start a focus session for the first work block.
6. Complete or delete tasks as work progresses.

This workflow brings task organization, prioritization, planning, and focus into one developer workspace.

## Deployment

### Frontend — Vercel
- Connect the GitHub repository to Vercel.
- Select Vite as the frontend framework.
- Set the project root to the frontend directory.
- Use `npm run build` as the build command.
- Use `dist` as the output directory.

### Backend — Render
- Create a Web Service using the backend code.
- Set the root directory to `server` if deploying from the repository root.
- Use `npm install` for dependency installation.
- Use `npm start` as the start command.
- Configure `FRONTEND_URL` with the deployed frontend URL.
- Verify the health endpoint and MCP endpoint after deployment.

## Project Structure

```text
CampusFlow-AI/
├── src/
│   ├── App.jsx
│   ├── App.css
│   └── ...
├── server/
│   ├── index.js
│   ├── tools.js
│   ├── package.json
│   └── data.json
├── package.json
├── README.md
└── ...
```

This is a representative structure. Keep the file paths aligned with the actual repository.

## Design Goals

- **Developer-first:** Built around coding tasks and development workflows.
- **Actionable intelligence:** Explains task rankings and recommends the next step.
- **Tool-based architecture:** Uses MCP to expose productivity functions.
- **Accessible workflow:** Combines task management, planning, and focus sessions.
- **Practical deployment:** Separates the frontend and backend for independent hosting.

## Current Limitations

- The assistant uses predefined command handling rather than a general-purpose language model.
- Voice input depends on browser support and permissions.
- Task storage currently uses a JSON file; persistent storage must be configured for reliable retention across hosting restarts and redeployments.
- The focus timer uses backend process memory and may reset if the backend restarts.
- A successful MCP connection does not automatically establish compatibility with every external agent or the complete Alexa+ platform.

## Future Improvements

- Persistent database integration.
- Improved natural-language command interpretation.
- More advanced sprint scheduling and progress analytics.
- User authentication and individual workspaces.
- Enhanced timer persistence and session history.
- Additional MCP tools and integrations.

## Hackathon Context

CampusFlow AI was built for the **Alexa+ Simulated Experience** track, demonstrating how an application can organize productivity capabilities behind an MCP-based tool interface.

The project provides a web-based demonstration of developer workflows without requiring a paid AI API for its current predefined functionality.

## Author

**Shaikh abdul rakheeb**

Electronics and Computer Engineering Student | Software Development | Java | DSA | React | Node.js | MCP

---

*CampusFlow AI — Turn coding goals into focused progress.*
