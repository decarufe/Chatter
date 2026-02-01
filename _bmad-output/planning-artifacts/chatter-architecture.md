# Chatter - Technical Architecture

### _Telegram ↔ VS Code Copilot Bridge_

**Version:** 0.1.0  
**Date:** 2026-01-31  
**Architect:** Winston  
**Status:** Draft

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEVELOPER'S MACHINE                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         VS CODE                                      │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐   │   │
│  │  │   Chatter       │◄──►│  Copilot Chat   │◄──►│   Workspace    │   │   │
│  │  │   Extension     │    │  Extension API  │    │   Files        │   │   │
│  │  └────────┬────────┘    └─────────────────┘    └────────────────┘   │   │
│  │           │                                                          │   │
│  │           │ HTTP Server (localhost:3847)                            │   │
│  └───────────┼──────────────────────────────────────────────────────────┘   │
│              │                                                              │
│  ┌───────────▼───────────┐                                                  │
│  │   Tunnel Service      │  (Cloudflare Tunnel / ngrok / localtunnel)      │
│  │   https://xxx.trycloudflare.com                                         │
│  └───────────┬───────────┘                                                  │
└──────────────┼──────────────────────────────────────────────────────────────┘
               │
               │ HTTPS (Webhook)
               ▼
┌──────────────────────────────┐
│      TELEGRAM SERVERS        │
│  ┌────────────────────────┐  │
│  │    Chatter Bot         │  │
│  │    @YourChatterBot     │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
               ▲
               │ Telegram API
               ▼
┌──────────────────────────────┐
│     📱 DEVELOPER PHONE       │
│         Telegram App         │
└──────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 VS Code Extension Structure

```
chatter/
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript config
├── .vscodeignore                 # Files to exclude from package
├── README.md                     # User documentation
├── CHANGELOG.md                  # Version history
├── src/
│   ├── extension.ts              # Extension entry point, activation
│   ├── core/
│   │   ├── copilot-bridge.ts     # Interface with Copilot Chat API
│   │   ├── task-manager.ts       # Track ongoing AI tasks & state
│   │   ├── workspace-context.ts  # Project state & file summaries
│   │   └── command-executor.ts   # Execute commands from Telegram
│   ├── server/
│   │   ├── webhook-server.ts     # Express/Fastify HTTP server
│   │   ├── tunnel-manager.ts     # Manage Cloudflare/ngrok tunnel
│   │   └── routes/
│   │       ├── telegram.ts       # Telegram webhook handler
│   │       └── health.ts         # Health check endpoint
│   ├── telegram/
│   │   ├── bot-client.ts         # Telegram Bot API client
│   │   ├── message-formatter.ts  # Format responses for Telegram
│   │   ├── inline-keyboards.ts   # Quick action buttons
│   │   └── commands/
│   │       ├── index.ts          # Command registry
│   │       ├── start.ts          # /start command
│   │       ├── status.ts         # /status command
│   │       ├── ask.ts            # /ask <question>
│   │       ├── task.ts           # /task <description>
│   │       ├── pause.ts          # /pause
│   │       ├── resume.ts         # /resume
│   │       ├── diff.ts           # /diff - show pending changes
│   │       ├── approve.ts        # /approve - apply changes
│   │       ├── reject.ts         # /reject - discard changes
│   │       └── help.ts           # /help
│   ├── security/
│   │   ├── auth.ts               # User authentication
│   │   ├── rate-limiter.ts       # Prevent abuse
│   │   └── encryption.ts         # Secure token storage
│   ├── ui/
│   │   ├── status-bar.ts         # Status bar item management
│   │   ├── config-wizard.ts      # Setup wizard UI
│   │   └── notifications.ts      # VS Code notification helpers
│   └── utils/
│       ├── config.ts             # Extension settings
│       ├── logger.ts             # Structured logging
│       └── constants.ts          # App constants
└── test/
    ├── suite/
    │   ├── extension.test.ts
    │   ├── copilot-bridge.test.ts
    │   ├── task-manager.test.ts
    │   └── telegram-commands.test.ts
    └── mock/
        ├── mock-telegram.ts
        └── mock-copilot.ts
```

---

## 3. Core Components

### 3.1 Extension Entry Point

**File:** `src/extension.ts`

```typescript
import * as vscode from "vscode";
import { WebhookServer } from "./server/webhook-server";
import { TunnelManager } from "./server/tunnel-manager";
import { TaskManager } from "./core/task-manager";
import { StatusBarManager } from "./ui/status-bar";

export function activate(context: vscode.ExtensionContext) {
  const taskManager = new TaskManager(context);
  const webhookServer = new WebhookServer(taskManager);
  const tunnelManager = new TunnelManager(webhookServer);
  const statusBar = new StatusBarManager();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("chatter.configure", () =>
      configureWizard(),
    ),
    vscode.commands.registerCommand("chatter.start", () => startServer()),
    vscode.commands.registerCommand("chatter.stop", () => stopServer()),
  );

  // Auto-start if configured
  if (isConfigured()) {
    startServer();
  }
}

export function deactivate() {
  // Cleanup
}
```

---

### 3.2 Key Interfaces

```typescript
// Core state machine for AI tasks
interface TaskState {
  id: string;
  status:
    | "idle"
    | "running"
    | "paused"
    | "awaiting_approval"
    | "completed"
    | "failed";
  description: string;
  subtasks: Subtask[];
  currentSubtask: number;
  startedAt: Date;
  lastUpdate: Date;
  pendingChanges: FileChange[];
  conversationHistory: Message[];
  metadata: {
    filesModified: string[];
    linesAdded: number;
    linesRemoved: number;
  };
}

interface Subtask {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
}

interface FileChange {
  filePath: string;
  action: "create" | "modify" | "delete";
  originalContent?: string;
  newContent: string;
  diff: string;
}

// Bridge to Copilot Chat
interface CopilotBridge {
  sendMessage(
    prompt: string,
    context?: WorkspaceContext,
  ): Promise<CopilotResponse>;
  streamResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
  ): Promise<void>;
  getConversationHistory(): Message[];
  clearContext(): void;
  isAvailable(): boolean;
}

interface CopilotResponse {
  text: string;
  suggestions?: CodeSuggestion[];
  needsInput?: boolean;
  question?: string;
}

interface WorkspaceContext {
  files: string[];
  currentFile?: string;
  selection?: vscode.Range;
  diagnostics?: vscode.Diagnostic[];
}

// Telegram command handler
interface TelegramCommand {
  command: string;
  description: string;
  usage?: string;
  execute(
    args: string[],
    chatId: number,
    messageId: number,
  ): Promise<TelegramResponse>;
}

interface TelegramResponse {
  text: string;
  parseMode?: "Markdown" | "HTML";
  replyMarkup?: InlineKeyboard;
  disablePreview?: boolean;
}

// Configuration
interface ChatterConfig {
  telegram: {
    botToken: string;
    allowedUserId: number;
    secretToken: string;
  };
  server: {
    port: number;
    host: string;
  };
  tunnel: {
    provider: "cloudflare" | "ngrok" | "localtunnel" | "manual";
    customUrl?: string;
  };
  notifications: {
    level: "all" | "important" | "errors-only";
    sound: boolean;
  };
  copilot: {
    timeout: number;
    maxRetries: number;
  };
}
```

---

## 4. Data Flow Diagrams

### 4.1 Command Flow (Telegram → VS Code)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Telegram │    │ Webhook  │    │ Auth     │    │ Command  │    │ Task     │
│ Message  │───►│ Server   │───►│ Validator│───►│ Router   │───►│ Manager  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └────┬─────┘
     │                                                                │
     │                                                                ▼
     │                                                          ┌──────────┐
     │                                                          │ Copilot  │
     │                                                          │ Bridge   │
     │                                                          └────┬─────┘
     │                                                                │
     │                         Response Path                          │
     ◄────────────────────────────────────────────────────────────────┘
```

**Step-by-step:**

1. Telegram sends webhook POST to tunnel URL
2. Webhook server receives and validates request
3. Auth validator checks user ID and secret token
4. Command router identifies command and extracts args
5. Task manager updates state machine
6. Copilot bridge sends prompt to Copilot Chat
7. Response formatted and sent back to Telegram

---

### 4.2 Notification Flow (VS Code → Telegram)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Task     │    │ Event    │    │ Notif    │    │ Telegram │
│ State    │───►│ Emitter  │───►│ Filter   │───►│ Bot API  │
│ Change   │    │          │    │          │    │ sendMsg  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Event Types:**

- `task:started`
- `task:paused`
- `task:resumed`
- `task:completed`
- `task:failed`
- `subtask:completed`
- `input:required`
- `changes:ready`
- `error:occurred`

---

### 4.3 Task Execution Flow

```
/task command
     │
     ▼
┌─────────────────┐
│ Parse task desc │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create TaskState│
│ status: running │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Send to Copilot │◄──────┐
│ "Implement X"   │        │
└────────┬────────┘        │
         │                 │
         ▼                 │
┌─────────────────┐        │
│ Copilot suggests│        │
│ changes         │        │
└────────┬────────┘        │
         │                 │
         ▼                 │
┌─────────────────┐        │
│ Store in memory │        │
│ pendingChanges  │        │
└────────┬────────┘        │
         │                 │
         ▼                 │
┌─────────────────┐        │
│ Copilot asks    │        │
│ clarification?  │────Yes─┘
└────────┬────────┘
         │
        No
         │
         ▼
┌─────────────────┐
│ Notify user     │
│ changes ready   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ await /approve  │
│ or /reject      │
└─────────────────┘
```

---

## 5. Security Architecture

### 5.1 Authentication Model

**Single-User Mode (MVP):**

```typescript
interface AuthConfig {
  mode: "single-user";
  telegramUserId: number; // Only accept messages from this user
  secretToken: string; // Webhook verification token
}

function validateRequest(req: Request): boolean {
  // 1. Verify Telegram signature
  const signature = req.headers["x-telegram-bot-api-secret-token"];
  if (signature !== config.telegram.secretToken) {
    return false;
  }

  // 2. Verify user ID
  const message = req.body.message;
  if (message.from.id !== config.telegram.allowedUserId) {
    logger.warn("Unauthorized access attempt", { userId: message.from.id });
    return false;
  }

  return true;
}
```

**Future: Multi-User Mode:**

```typescript
interface MultiUserAuthConfig {
  mode: "multi-user";
  allowedUsers: Map<number, UserPermissions>;
  oauthProvider: "github" | "microsoft";
}

interface UserPermissions {
  userId: number;
  role: "admin" | "developer" | "viewer";
  allowedCommands: string[];
  rateLimit: number;
}
```

---

### 5.2 Security Layers

| Layer                    | Implementation                           | Notes                          |
| ------------------------ | ---------------------------------------- | ------------------------------ |
| **Transport**            | HTTPS via tunnel (TLS 1.3)               | Tunnel provider handles cert   |
| **Webhook Verification** | `X-Telegram-Bot-Api-Secret-Token` header | Random 32-char string          |
| **User Verification**    | Telegram user ID allowlist               | Stored in extension config     |
| **Rate Limiting**        | 10 commands/minute per user              | Using sliding window algorithm |
| **Command Sanitization** | Whitelist commands, escape args          | No shell injection possible    |
| **File Path Validation** | Restrict to workspace root               | No path traversal              |
| **Sensitive Data**       | Bot token in SecretStorage               | OS-level encryption            |

---

### 5.3 Rate Limiting

```typescript
class RateLimiter {
  private readonly windows = new Map<number, number[]>();
  private readonly limit = 10; // commands per minute
  private readonly windowMs = 60000;

  check(userId: number): boolean {
    const now = Date.now();
    const userWindow = this.windows.get(userId) || [];

    // Remove timestamps outside window
    const validTimestamps = userWindow.filter((ts) => now - ts < this.windowMs);

    if (validTimestamps.length >= this.limit) {
      return false;
    }

    validTimestamps.push(now);
    this.windows.set(userId, validTimestamps);
    return true;
  }
}
```

---

## 6. Technology Stack

| Component             | Technology                      | Rationale                                         |
| --------------------- | ------------------------------- | ------------------------------------------------- |
| **Extension Runtime** | TypeScript + VS Code API        | Native integration, type safety                   |
| **HTTP Server**       | Fastify                         | Lightweight (< 1MB), fast, TypeScript-first       |
| **Telegram SDK**      | grammy                          | Modern, well-maintained, great TypeScript support |
| **Tunnel**            | Cloudflare Tunnel (cloudflared) | Free, no account needed, reliable                 |
| **State Management**  | In-memory + workspace storage   | Simple, no external DB needed                     |
| **Logging**           | VS Code OutputChannel           | Native, easy debugging                            |
| **Testing**           | Vitest + VS Code Test API       | Fast, modern, good mocking                        |
| **Build**             | esbuild                         | Fast bundling, tree-shaking                       |
| **Package Manager**   | npm                             | Standard for VS Code extensions                   |

---

## 7. Deployment Architecture

### 7.1 Extension Distribution

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTENSION LIFECYCLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Development                                                │
│  └─► npm run compile                                        │
│  └─► npm run test                                           │
│  └─► npm run package (creates .vsix)                        │
│                                                             │
│  Publishing                                                 │
│  └─► vsce publish (VS Code Marketplace)                     │
│  └─► ovsx publish (OpenVSX Registry)                        │
│                                                             │
│  Installation                                               │
│  └─► VS Code Marketplace (auto-updates)                     │
│  └─► Manual .vsix install (offline)                         │
│                                                             │
│  Runtime                                                    │
│  └─► Extension Host Process                                 │
│      └─► Node.js runtime (provided by VS Code)             │
│      └─► Access to VS Code API                             │
│      └─► Sandboxed environment                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 7.2 First-Time Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ONBOARDING FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Install Extension                                  │
│  └─► VS Code Marketplace → Search "Chatter"                 │
│  └─► Click Install                                          │
│                                                             │
│  Step 2: Create Telegram Bot                                │
│  └─► Open Telegram → Message @BotFather                     │
│  └─► Send: /newbot                                          │
│  └─► Follow prompts → Get bot token                         │
│                                                             │
│  Step 3: Get Your User ID                                   │
│  └─► Message @userinfobot                                   │
│  └─► Copy your user ID                                      │
│                                                             │
│  Step 4: Configure Extension                                │
│  └─► Cmd+Shift+P → "Chatter: Configure"                     │
│  └─► Paste bot token                                        │
│  └─► Enter user ID                                          │
│  └─► Extension validates token                              │
│                                                             │
│  Step 5: Start Chatter                                      │
│  └─► Cmd+Shift+P → "Chatter: Start"                         │
│  └─► Server starts on localhost:3847                        │
│  └─► Tunnel created (Cloudflare)                            │
│  └─► Webhook registered with Telegram                       │
│  └─► Status bar shows 🟢                                     │
│                                                             │
│  Step 6: Test Connection                                    │
│  └─► Open your bot in Telegram                              │
│  └─► Send: /start                                           │
│  └─► Bot replies: "🟢 Connected to VS Code!"                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Tunnel Strategy

### 8.1 Cloudflare Tunnel (Primary)

```typescript
class CloudflareTunnelManager {
  async start(port: number): Promise<string> {
    // Download cloudflared binary if not present
    await this.ensureBinary();

    // Start tunnel
    const process = spawn("cloudflared", [
      "tunnel",
      "--url",
      `http://localhost:${port}`,
      "--no-autoupdate",
    ]);

    // Parse tunnel URL from output
    const url = await this.parseUrl(process.stdout);

    // Register webhook with Telegram
    await this.registerWebhook(url);

    return url;
  }
}
```

**Advantages:**

- No account required
- Free
- Auto HTTPS
- Stable connections
- Cross-platform

**Disadvantages:**

- Random URL (changes on restart)
- External dependency

---

### 8.2 Alternative: ngrok

```typescript
class NgrokTunnelManager {
  async start(port: number): Promise<string> {
    const url = await ngrok.connect({
      addr: port,
      authtoken: config.ngrok.authToken, // optional
    });

    await this.registerWebhook(url);
    return url;
  }
}
```

**Advantages:**

- Static URL (with paid plan)
- Dashboard/logs
- Traffic inspection

**Disadvantages:**

- Account required for static URL
- Rate limits on free tier

---

## 9. State Management

### 9.1 Task State Persistence

```typescript
class TaskManager {
  private currentTask: TaskState | null = null;

  constructor(private context: vscode.ExtensionContext) {
    // Restore state on activation
    this.restore();
  }

  private async save() {
    await this.context.workspaceState.update(
      "chatter.currentTask",
      this.currentTask,
    );
  }

  private restore() {
    this.currentTask = this.context.workspaceState.get("chatter.currentTask");
  }

  startTask(description: string): TaskState {
    this.currentTask = {
      id: generateId(),
      status: "running",
      description,
      subtasks: [],
      currentSubtask: 0,
      startedAt: new Date(),
      lastUpdate: new Date(),
      pendingChanges: [],
      conversationHistory: [],
      metadata: {
        filesModified: [],
        linesAdded: 0,
        linesRemoved: 0,
      },
    };

    this.save();
    return this.currentTask;
  }
}
```

---

### 9.2 Configuration Storage

```typescript
class ConfigManager {
  constructor(private context: vscode.ExtensionContext) {}

  async saveBotToken(token: string): Promise<void> {
    // Use SecretStorage for sensitive data
    await this.context.secrets.store("chatter.botToken", token);
  }

  async getBotToken(): Promise<string | undefined> {
    return await this.context.secrets.get("chatter.botToken");
  }

  saveUserId(userId: number): void {
    // Use workspace config for non-sensitive data
    vscode.workspace
      .getConfiguration("chatter")
      .update(
        "telegram.allowedUserId",
        userId,
        vscode.ConfigurationTarget.Global,
      );
  }
}
```

---

## 10. Error Handling & Resilience

### 10.1 Error Categories

| Category          | Examples                           | Handling Strategy                      |
| ----------------- | ---------------------------------- | -------------------------------------- |
| **Configuration** | Invalid token, missing user ID     | Show wizard, clear instructions        |
| **Network**       | Tunnel down, Telegram unreachable  | Auto-retry with backoff, notify user   |
| **Copilot**       | Extension not installed, API error | Graceful fallback, clear error message |
| **User Input**    | Invalid command, malformed args    | Show usage help, suggest corrections   |
| **File System**   | Permission denied, disk full       | Rollback changes, notify user          |
| **Security**      | Unauthorized access                | Log incident, optionally notify user   |

---

### 10.2 Retry Strategy

```typescript
class RetryHandler {
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < options.maxAttempts) {
          const delay = options.baseDelay * Math.pow(2, attempt - 1);
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }
}
```

---

## 11. Performance Considerations

### 11.1 Resource Usage

| Resource    | Expected Usage                     | Mitigation                             |
| ----------- | ---------------------------------- | -------------------------------------- |
| **Memory**  | ~50MB (extension) + ~10MB (tunnel) | Monitor task state size, limit history |
| **CPU**     | Minimal (event-driven)             | Async operations, no polling           |
| **Network** | Webhook traffic only               | Lightweight JSON payloads              |
| **Disk**    | < 10MB (extension bundle)          | Tree-shake dependencies                |

---

### 11.2 Optimization Strategies

1. **Lazy Loading:** Load Copilot bridge only when needed
2. **Debouncing:** Batch status updates (max 1 per 5 seconds)
3. **Streaming:** Stream Copilot responses for large outputs
4. **Caching:** Cache workspace context between commands
5. **Pagination:** Split large diffs across multiple messages

---

## 12. Testing Strategy

### 12.1 Test Pyramid

```
        ┌─────────┐
        │   E2E   │  (5%) - Full integration via .vsix install
        └────┬────┘
           ┌─┴───────┐
           │  Integ  │    (20%) - Component integration
           └────┬────┘
              ┌─┴─────────┐
              │   Unit    │      (75%) - Individual functions
              └───────────┘
```

---

### 12.2 Test Coverage

| Component             | Type        | Framework          | Mocks Needed      |
| --------------------- | ----------- | ------------------ | ----------------- |
| **Copilot Bridge**    | Unit        | Vitest             | Copilot API       |
| **Task Manager**      | Unit        | Vitest             | Workspace storage |
| **Telegram Commands** | Unit        | Vitest             | Bot API           |
| **Webhook Server**    | Integration | Vitest + Supertest | None              |
| **Auth Validator**    | Unit        | Vitest             | None              |
| **Full Flow**         | E2E         | VS Code Test API   | Mock Telegram     |

---

## 13. Monitoring & Observability

### 13.1 Logging Strategy

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private output: vscode.OutputChannel;

  constructor() {
    this.output = vscode.window.createOutputChannel("Chatter");
  }

  info(message: string, meta?: object) {
    this.log(LogLevel.INFO, message, meta);
  }

  error(message: string, error?: Error) {
    this.log(LogLevel.ERROR, message, {
      error: error?.message,
      stack: error?.stack,
    });
  }

  private log(level: LogLevel, message: string, meta?: object) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${LogLevel[level]}] ${message}`;
    this.output.appendLine(meta ? `${line} ${JSON.stringify(meta)}` : line);
  }
}
```

---

### 13.2 Metrics

| Metric                    | Purpose        | Implementation            |
| ------------------------- | -------------- | ------------------------- |
| **Commands per session**  | Usage tracking | Counter in memory         |
| **Task completion rate**  | Success rate   | Tasks completed / started |
| **Average task duration** | Performance    | Track start/end times     |
| **Error rate**            | Reliability    | Errors / total commands   |
| **Tunnel uptime**         | Reliability    | Track disconnect events   |

---

## 14. Scalability Considerations

### 14.1 Current Limitations

- **Single workspace:** One active workspace at a time
- **Single user:** One Telegram user per instance
- **No persistence:** Task state lost on VS Code restart
- **In-memory state:** All state in RAM

### 14.2 Future Scaling Path

**Phase 2: Multi-Workspace**

```typescript
class WorkspaceManager {
  private workspaces = new Map<string, TaskManager>();

  getTaskManager(workspaceUri: string): TaskManager {
    if (!this.workspaces.has(workspaceUri)) {
      this.workspaces.set(workspaceUri, new TaskManager(workspaceUri));
    }
    return this.workspaces.get(workspaceUri)!;
  }
}
```

**Phase 3: Multi-User**

```typescript
class MultiUserManager {
  private users = new Map<number, UserSession>();

  getSession(userId: number): UserSession {
    // Each user gets isolated session
  }
}
```

---

## 15. Risk Assessment & Mitigation

| Risk                     | Impact   | Probability | Mitigation                                 |
| ------------------------ | -------- | ----------- | ------------------------------------------ |
| **Copilot API changes**  | High     | Medium      | Abstract behind interface, monitor updates |
| **Tunnel instability**   | Medium   | Low         | Auto-reconnect, multiple provider support  |
| **Security breach**      | Critical | Low         | Strict user validation, no code exec       |
| **Rate limiting**        | Low      | Low         | Queue + backoff, user notification         |
| **VS Code crashes**      | Medium   | Low         | State persistence, graceful recovery       |
| **Telegram API changes** | Low      | Very Low    | SDK abstracts API, versioned protocol      |

---

## 16. Future Architecture Considerations

### 16.1 Cloud Relay Option

For production deployments needing stability:

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   VS Code    │◄───WSS──┤ Cloud Relay  │◄──HTTPS─┤   Telegram   │
│   Extension  │         │   Service    │         │   Servers    │
└──────────────┘         └──────────────┘         └──────────────┘
```

**Benefits:**

- Static webhook URL
- Persistent queue (survive VS Code restarts)
- Multi-device support
- Better reliability

**Trade-offs:**

- Added complexity
- Hosting costs
- Privacy concerns (messages through server)

---

### 16.2 Plugin Architecture

For extensibility:

```typescript
interface ChatterPlugin {
  name: string;
  version: string;
  commands: TelegramCommand[];
  onTaskComplete?: (task: TaskState) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

class PluginManager {
  register(plugin: ChatterPlugin): void {
    // Register custom commands
    // Hook into task lifecycle
  }
}
```

**Example Plugins:**

- Git integration (`/commit`, `/push`)
- Test runner (`/test`, `/coverage`)
- Deployment (`/deploy dev`, `/deploy prod`)
- Custom AI models (`/claude`, `/gpt4`)

---

## 17. Compliance & Privacy

### 17.1 Data Handling

| Data Type         | Storage           | Retention           | Encryption           |
| ----------------- | ----------------- | ------------------- | -------------------- |
| **Bot Token**     | SecretStorage     | Until user removes  | OS-level             |
| **User ID**       | Workspace config  | Until user removes  | None (non-sensitive) |
| **Task State**    | Workspace storage | Until task complete | None                 |
| **Conversation**  | In-memory only    | Session only        | None                 |
| **File Contents** | Never stored      | N/A                 | N/A                  |

### 17.2 Privacy Considerations

- ✅ All processing local (no cloud service)
- ✅ No telemetry/analytics in MVP
- ✅ User has full control over bot
- ✅ No message history stored
- ✅ Open source (transparency)

---

## 18. Development Roadmap

### Phase 1: MVP (v0.1.0) - 5 weeks

- ✅ Basic architecture documented
- Week 1-2: Core extension + webhook server
- Week 3-4: Telegram commands + Copilot integration
- Week 5: Security hardening + docs

### Phase 2: Stability (v0.2.0) - 4 weeks

- State persistence
- Multi-workspace support
- Better error handling
- Performance optimizations

### Phase 3: Features (v0.3.0) - 6 weeks

- Multi-user support
- OAuth integration
- Plugin system
- Advanced notifications

### Phase 4: Polish (v1.0.0) - 4 weeks

- Full test coverage
- Comprehensive docs
- Marketplace optimization
- Community feedback integration

---

## Appendix A: Package.json Structure

```json
{
  "name": "chatter",
  "displayName": "Chatter - Remote Copilot Control",
  "description": "Control GitHub Copilot via Telegram",
  "version": "0.1.0",
  "publisher": "decarufe",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other", "AI", "Remote"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "chatter.configure",
        "title": "Chatter: Configure"
      },
      {
        "command": "chatter.start",
        "title": "Chatter: Start"
      },
      {
        "command": "chatter.stop",
        "title": "Chatter: Stop"
      }
    ],
    "configuration": {
      "title": "Chatter",
      "properties": {
        "chatter.telegram.allowedUserId": {
          "type": "number",
          "description": "Your Telegram user ID"
        },
        "chatter.server.port": {
          "type": "number",
          "default": 3847
        },
        "chatter.tunnel.provider": {
          "type": "string",
          "enum": ["cloudflare", "ngrok", "localtunnel", "manual"],
          "default": "cloudflare"
        },
        "chatter.notifications.level": {
          "type": "string",
          "enum": ["all", "important", "errors-only"],
          "default": "important"
        }
      }
    }
  },
  "dependencies": {
    "grammy": "^1.x",
    "fastify": "^4.x",
    "cloudflared": "^1.x"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "typescript": "^5.x",
    "vitest": "^1.x",
    "esbuild": "^0.19.x"
  }
}
```

---

## Appendix B: VS Code Extension API Usage

### Required APIs

| API                               | Purpose                   | Permission Level  |
| --------------------------------- | ------------------------- | ----------------- |
| `vscode.workspace`                | Read/write files          | Workspace access  |
| `vscode.window`                   | Show messages, status bar | UI access         |
| `vscode.commands`                 | Register commands         | Standard          |
| `ExtensionContext.secrets`        | Store bot token           | Secret storage    |
| `ExtensionContext.workspaceState` | Store task state          | Workspace storage |
| `vscode.OutputChannel`            | Logging                   | Standard          |

### Copilot Chat Integration

```typescript
// Note: This API is experimental and may change
interface CopilotChatAPI {
  sendMessage(message: string): Promise<string>;
  // Implementation may vary based on Copilot Chat extension
}

// Accessing Copilot Chat (if available)
const copilotExt = vscode.extensions.getExtension("github.copilot-chat");
if (copilotExt) {
  const api = await copilotExt.activate();
  // Use API
}
```

---

**Architecture Complete**

This document provides the technical foundation for implementing Chatter. All design decisions prioritize simplicity, security, and developer experience while maintaining extensibility for future enhancements.
