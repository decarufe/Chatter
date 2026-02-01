# Chatter - Product Requirements Document

### _Remote AI Development Control via Telegram_

**Version:** 0.1.0  
**Date:** 2026-01-31  
**Author:** John (Product Manager)  
**Status:** Draft

---

## 1. Problem Statement

### The Pain

Developers using AI coding assistants (GitHub Copilot) are **tethered to their IDE**. When AI is working on a task:

- You can't step away without losing oversight
- No mobile-friendly way to monitor progress
- Can't course-correct without returning to keyboard
- Missed context when AI makes wrong assumptions

### The Opportunity

**Async AI Supervision** - Control your AI coding assistant from anywhere via a messaging app you already use.

### Target User

Solo developers and small teams who:

- Use GitHub Copilot Chat regularly
- Want to multitask while AI handles implementation
- Value staying informed without constant screen-watching
- Already use Telegram (or willing to for this use case)

---

## 2. Product Vision

> **"Your AI pair programmer, a message away."**

Chatter bridges VS Code's Copilot Chat to Telegram, enabling developers to:

1. **Monitor** - See what AI is working on
2. **Direct** - Give instructions and answer questions
3. **Control** - Pause, resume, approve, or reject changes
4. **Review** - See diffs before they're applied

---

## 3. MVP Scope (v0.1.0)

### 3.1 User Stories

| ID        | As a...   | I want to...                                            | So that...                             | Priority |
| --------- | --------- | ------------------------------------------------------- | -------------------------------------- | -------- |
| **US-01** | Developer | Receive Telegram notifications when Copilot needs input | I can respond without being at my desk | **Must** |
| **US-02** | Developer | Ask Copilot questions via Telegram                      | I can get project context remotely     | **Must** |
| **US-03** | Developer | Start a coding task via Telegram                        | AI can begin work while I'm away       | **Must** |
| **US-04** | Developer | See current task status                                 | I know what AI is working on           | **Must** |
| **US-05** | Developer | Pause/resume AI work                                    | I maintain control over execution      | **Must** |
| **US-06** | Developer | Review file changes before applying                     | I don't get unwanted modifications     | **Must** |
| **US-07** | Developer | Approve or reject proposed changes                      | I control what gets written to disk    | **Must** |
| **US-08** | Developer | Configure the extension easily                          | I can get started in < 5 minutes       | **Must** |
| **US-09** | Developer | Have my bot token stored securely                       | My credentials aren't exposed          | **Must** |
| **US-10** | Developer | Only allow my Telegram account                          | No one else can control my IDE         | **Must** |

### 3.2 Feature Specifications

---

#### **F-01: Bot Setup & Connection**

**Description:** One-time configuration to link VS Code with your Telegram bot.

**Acceptance Criteria:**

- [ ] Command `Chatter: Configure` opens setup wizard
- [ ] Wizard guides user to create bot via @BotFather (with instructions)
- [ ] Bot token stored in VS Code SecretStorage (encrypted)
- [ ] User provides their Telegram user ID (with helper to find it)
- [ ] Configuration validates token before saving
- [ ] Clear error messages if token invalid

**UX Flow:**

```
1. Cmd+Shift+P → "Chatter: Configure"
2. Modal: "Let's set up Chatter! First, create a Telegram bot..."
   [Instructions to message @BotFather]
3. Input: "Paste your bot token"
4. Input: "Enter your Telegram user ID"
   [Link to @userinfobot to find it]
5. "Testing connection..." → ✅ "Connected! Message your bot to start."
```

---

#### **F-02: Server & Tunnel Management**

**Description:** Local server that receives Telegram webhooks via secure tunnel.

**Acceptance Criteria:**

- [ ] Command `Chatter: Start` launches server + tunnel
- [ ] Command `Chatter: Stop` gracefully shuts down
- [ ] Status bar indicator shows connection state: 🟢 Connected | 🟡 Connecting | 🔴 Disconnected
- [ ] Auto-reconnect on tunnel failure (3 retries, then notify user)
- [ ] Server starts on configurable port (default: 3847)
- [ ] Tunnel URL registered as Telegram webhook automatically

**Status Bar States:**
| Icon | Tooltip | Meaning |
|------|---------|---------|
| 🟢 Chatter | "Chatter: Connected to Telegram" | Fully operational |
| 🟡 Chatter | "Chatter: Connecting..." | Starting up or reconnecting |
| 🔴 Chatter | "Chatter: Disconnected - Click to start" | Not running |

---

#### **F-03: Core Telegram Commands**

**Description:** Bot commands for interacting with Copilot.

| Command               | Behavior                                 | Response Format                           |
| --------------------- | ---------------------------------------- | ----------------------------------------- |
| `/start`              | Initialize connection, confirm setup     | Welcome message + available commands      |
| `/status`             | Show current task state                  | Task name, progress, current activity     |
| `/ask <question>`     | Send question to Copilot about workspace | Copilot's response (formatted for mobile) |
| `/task <description>` | Start new coding task                    | Confirmation + initial plan               |
| `/pause`              | Pause current task execution             | Confirmation                              |
| `/resume`             | Resume paused task                       | Confirmation + next step                  |
| `/diff`               | Show pending file changes                | File list + inline diff preview           |
| `/approve`            | Apply pending changes to workspace       | Confirmation + files modified             |
| `/reject`             | Discard pending changes                  | Confirmation                              |
| `/help`               | List available commands                  | Command list with descriptions            |

**Response Formatting Rules:**

- Max 4096 characters per message (Telegram limit)
- Code blocks use monospace formatting
- Long diffs split into multiple messages
- Use inline keyboards for actions where appropriate

---

#### **F-04: Task Management**

**Description:** Track and control AI coding tasks.

**Task States:**

```
┌─────────┐    /task    ┌─────────┐   working   ┌──────────┐
│  IDLE   │───────────►│ RUNNING │────────────►│ AWAITING │
└─────────┘            └────┬────┘             │ APPROVAL │
     ▲                      │                  └────┬─────┘
     │                  /pause                      │
     │                      ▼                 /approve│/reject
     │                 ┌─────────┐                  │
     │                 │ PAUSED  │                  │
     │                 └────┬────┘                  │
     │                      │                       │
     │                  /resume                     │
     │                      │                       │
     └──────────────────────┴───────────────────────┘
```

**Acceptance Criteria:**

- [ ] Only one task active at a time
- [ ] Task state persisted to workspace storage
- [ ] `/status` shows: task description, current subtask, files touched
- [ ] Progress updates sent to Telegram at key milestones
- [ ] User can interrupt at any point with `/pause`

---

#### **F-05: Diff Review & Approval**

**Description:** Review AI-generated changes before applying.

**Acceptance Criteria:**

- [ ] Changes held in memory until approved
- [ ] `/diff` shows summary: X files changed, Y insertions, Z deletions
- [ ] Inline keyboard buttons: [Approve ✅] [Reject ❌] [View Full Diff]
- [ ] "View Full Diff" sends file-by-file diffs (paginated if needed)
- [ ] `/approve` writes all pending changes to disk
- [ ] `/reject` discards all pending changes
- [ ] Changes auto-rejected if VS Code closes (with warning)

**Diff Message Format:**

```
📝 Pending Changes

3 files modified:
• src/auth/login.ts (+45, -12)
• src/auth/types.ts (+8, -0)
• tests/auth.test.ts (+23, -5)

[Approve ✅] [Reject ❌] [View Details 📄]
```

---

#### **F-06: Notification System**

**Description:** Proactive updates from VS Code to Telegram.

**Notification Triggers:**
| Event | Message | Urgency |
|-------|---------|---------|
| Task started | "🚀 Started: {description}" | Low |
| Subtask completed | "✅ Completed: {subtask}" | Low |
| Needs input | "❓ Copilot asks: {question}" | **High** |
| Changes ready | "📝 Changes ready for review" | **High** |
| Task completed | "🎉 Task complete! {summary}" | Medium |
| Error occurred | "⚠️ Error: {message}" | **High** |

**Notification Settings:**

- `all` - Every update
- `important` - Only questions, changes ready, errors (default)
- `errors-only` - Only errors

---

#### **F-07: Security**

**Description:** Ensure only authorized access.

**Acceptance Criteria:**

- [ ] Bot token never logged or displayed after setup
- [ ] Only messages from configured Telegram user ID processed
- [ ] Unauthorized attempts logged + optionally notified
- [ ] Webhook endpoint validates Telegram's secret token header
- [ ] No arbitrary command execution (commands are predefined)
- [ ] File operations scoped to workspace only

---

## 4. Out of Scope (MVP)

| Feature                 | Reason               | Future Phase |
| ----------------------- | -------------------- | ------------ |
| Multi-user support      | Complexity           | Phase 2      |
| Multiple workspaces     | Complexity           | Phase 2      |
| Voice messages          | Nice-to-have         | Phase 3      |
| Screenshot sharing      | Nice-to-have         | Phase 3      |
| Persistent task history | Not critical for MVP | Phase 2      |
| Custom commands         | Power feature        | Phase 2      |
| Other chat platforms    | Telegram-first       | Phase 3+     |

---

## 5. Technical Constraints

| Constraint                        | Impact                  | Mitigation                |
| --------------------------------- | ----------------------- | ------------------------- |
| VS Code must be running           | No background operation | Clear documentation       |
| Copilot Chat API unofficial       | May break               | Abstract behind interface |
| Tunnel required for webhooks      | Setup complexity        | One-click tunnel setup    |
| Telegram message size limit (4KB) | Long diffs truncated    | Pagination + "View Full"  |

---

## 6. Success Metrics

| Metric                | Target           | Measurement                      |
| --------------------- | ---------------- | -------------------------------- |
| Setup completion rate | > 80%            | Users who complete config wizard |
| Daily active usage    | > 3 commands/day | Commands processed               |
| Task completion rate  | > 70%            | Tasks reaching /approve          |
| Error rate            | < 5%             | Failed commands / total          |

---

## 7. User Journey (Happy Path)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📱 DEVELOPER'S MORNING                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  9:00 AM - At desk                                                  │
│  └─► Opens VS Code, starts Chatter (Cmd+Shift+P → Chatter: Start)  │
│  └─► Status bar shows 🟢                                            │
│                                                                     │
│  9:15 AM - Heading to meeting                                       │
│  └─► Messages bot: /task Add rate limiting to auth endpoints       │
│  └─► Bot: "🚀 Started: Add rate limiting to auth endpoints"         │
│                                                                     │
│  9:45 AM - In meeting, phone buzzes                                │
│  └─► Bot: "❓ Should rate limit be per-user or per-IP?"            │
│  └─► Developer replies: "Per-user, 100 requests per minute"        │
│  └─► Bot: "✅ Got it. Continuing..."                                │
│                                                                     │
│  10:30 AM - Meeting ends, phone buzzes                              │
│  └─► Bot: "📝 Changes ready for review - 4 files modified"          │
│  └─► Developer taps [View Details]                                 │
│  └─► Reviews diff on phone                                          │
│  └─► Taps [Approve ✅]                                              │
│  └─► Bot: "✅ Applied! 4 files updated."                            │
│                                                                     │
│  11:00 AM - Back at desk                                            │
│  └─► Opens VS Code - sees new rate limiting code, ready for review │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Release Plan

| Version          | Features                 | Timeline |
| ---------------- | ------------------------ | -------- |
| **v0.1.0-alpha** | F-01, F-02, F-03 (basic) | Week 1-2 |
| **v0.1.0-beta**  | + F-04, F-05, F-06       | Week 3-4 |
| **v0.1.0**       | + F-07 hardening, docs   | Week 5   |

---

## 9. Architecture Overview

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
│  │   Tunnel Service      │  (Cloudflare Tunnel / ngrok)                    │
│  └───────────┬───────────┘                                                  │
└──────────────┼──────────────────────────────────────────────────────────────┘
               │
               │ HTTPS (Webhook)
               ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│      TELEGRAM SERVERS        │◄───────►│     📱 DEVELOPER PHONE       │
│      @YourChatterBot         │         │         Telegram App         │
└──────────────────────────────┘         └──────────────────────────────┘
```

---

## 10. Open Questions

1. **Copilot API Stability:** How stable is the VS Code Copilot Chat extension API? Need to investigate.
2. **Tunnel Reliability:** Should we support fallback to polling if tunnel fails?
3. **Task Granularity:** How do we break down a `/task` into subtasks for progress reporting?
4. **Diff Size Limits:** What's the practical limit before diffs become unreadable on mobile?

---

## Appendix A: Telegram Bot Commands Reference

```
start - Initialize Chatter connection
status - Show current task status
ask - Ask Copilot a question about the project
task - Start a new coding task
pause - Pause the current task
resume - Resume a paused task
diff - Show pending file changes
approve - Apply pending changes
reject - Discard pending changes
help - Show available commands
```

---

## Appendix B: Extension Settings

```jsonc
{
  "chatter.telegram.botToken": "", // Stored in SecretStorage
  "chatter.telegram.allowedUserId": 0, // Your Telegram user ID
  "chatter.server.port": 3847, // Local server port
  "chatter.tunnel.provider": "cloudflare", // cloudflare | ngrok | manual
  "chatter.notifications.level": "important", // all | important | errors-only
}
```
