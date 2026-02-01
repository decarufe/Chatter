"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookServer = void 0;
const vscode = __importStar(require("vscode"));
const fastify_1 = __importDefault(require("fastify"));
const grammy_1 = require("grammy");
const copilot_bridge_1 = require("../core/copilot-bridge");
const config_1 = require("../utils/config");
const command_handler_1 = require("../telegram/command-handler");
class WebhookServer {
    context;
    logger;
    server;
    bot;
    copilot;
    config;
    commandHandler;
    port;
    constructor(context, logger) {
        this.context = context;
        this.logger = logger;
        this.config = new config_1.ConfigManager(context);
        this.copilot = new copilot_bridge_1.CopilotBridge(logger);
        this.port = vscode.workspace
            .getConfiguration("chatter")
            .get("server.port", 3847);
        // Initialize Fastify
        this.server = (0, fastify_1.default)({ logger: false });
        // Bot will be initialized in start() when we have the token
        // Initialize command handler
        this.commandHandler = new command_handler_1.CommandHandler(this.copilot, this.logger);
    }
    async start() {
        const botToken = await this.config.getBotToken();
        const secretToken = await this.config.getSecretToken();
        const allowedUserId = this.config.getUserId();
        if (!botToken || !allowedUserId) {
            throw new Error(`Configuration incomplete. Bot token: ${botToken ? "present" : "missing"}, User ID: ${allowedUserId || "missing"}`);
        }
        this.logger.info(`Starting bot with token length: ${botToken.length}`);
        // Initialize bot with token
        this.bot = new grammy_1.Bot(botToken);
        // Note: We don't call bot.init() here because grammy will lazy-load
        // the bot info when needed. This avoids network calls during startup.
        this.logger.info("Bot created successfully");
        // Setup webhook endpoint
        this.server.post("/webhook", async (request, reply) => {
            this.logger.info("Webhook received");
            // Verify secret token
            const receivedToken = request.headers["x-telegram-bot-api-secret-token"];
            this.logger.info(`Secret token match: ${receivedToken === secretToken}`);
            if (receivedToken !== secretToken) {
                this.logger.warn("Invalid secret token received");
                return reply.code(401).send({ error: "Unauthorized" });
            }
            // Verify user ID
            const update = request.body;
            const userId = update.message?.from?.id || update.callback_query?.from?.id;
            this.logger.info(`Message from user ${userId}, allowed: ${allowedUserId}`);
            if (userId !== allowedUserId) {
                this.logger.warn(`Unauthorized access attempt from user ${userId}`);
                return reply.code(403).send({ error: "Forbidden" });
            }
            // Process update
            try {
                this.logger.info(`Processing update: ${JSON.stringify(update).substring(0, 200)}`);
                await this.bot.handleUpdate(update);
                return reply.send({ ok: true });
            }
            catch (error) {
                this.logger.error("Error processing update", error);
                return reply.code(500).send({ error: "Internal error" });
            }
        });
        // Health check endpoint
        this.server.get("/health", async (request, reply) => {
            return reply.send({ status: "ok", timestamp: new Date().toISOString() });
        });
        // Setup bot commands
        this.setupBotCommands();
        // Start server
        await this.server.listen({ port: this.port, host: "0.0.0.0" });
        this.logger.info(`Webhook server listening on port ${this.port}`);
        // Display webhook URL instructions
        vscode.window
            .showInformationMessage(`Chatter server running on http://localhost:${this.port}/webhook\n` +
            "Use ngrok or similar to expose this endpoint, then set it as your Telegram webhook.", "Copy URL")
            .then((selection) => {
            if (selection === "Copy URL") {
                vscode.env.clipboard.writeText(`http://localhost:${this.port}/webhook`);
            }
        });
    }
    setupBotCommands() {
        // /start command
        this.bot.command("start", async (ctx) => {
            await ctx.reply("🟢 *Chatter Connected!*\n\n" +
                "Your VS Code is now connected to Telegram.\n\n" +
                "*Available Commands:*\n" +
                "/ask - Ask Copilot a question\n" +
                "/context - Ask with workspace context\n" +
                "/clear - Clear conversation history\n" +
                "/status - Check connection status\n" +
                "/help - Show this help message\n\n" +
                "_Example: /ask How do I create a TypeScript interface?_", { parse_mode: "Markdown" });
            this.logger.info("User started conversation");
        });
        // /help command
        this.bot.command("help", async (ctx) => {
            await ctx.reply("*Chatter Help*\n\n" +
                "*Commands:*\n" +
                "• `/ask <question>` - Ask Copilot anything\n" +
                "• `/context <question>` - Ask with current file context\n" +
                "• `/clear` - Clear conversation history\n" +
                "• `/status` - Check connection status\n" +
                "• `/help` - Show this help\n\n" +
                "*Tips:*\n" +
                "• Copilot remembers your last few messages\n" +
                "• Use /context when asking about your current code\n" +
                "• Use /clear to start a fresh conversation", { parse_mode: "Markdown" });
        });
        // /ask command
        this.bot.command("ask", async (ctx) => {
            await this.commandHandler.handleAsk(ctx, false);
        });
        // /context command
        this.bot.command("context", async (ctx) => {
            await this.commandHandler.handleAsk(ctx, true);
        });
        // /clear command
        this.bot.command("clear", async (ctx) => {
            this.copilot.clearHistory();
            await ctx.reply("✅ Conversation history cleared!");
        });
        // /status command
        this.bot.command("status", async (ctx) => {
            const workspaceName = vscode.workspace.name || "No workspace";
            const activeFile = vscode.window.activeTextEditor?.document.fileName || "None";
            await ctx.reply(`*Chatter Status*\n\n` +
                `🟢 Connected to VS Code\n` +
                `📁 Workspace: ${workspaceName}\n` +
                `📄 Active File: ${activeFile}\n` +
                `💬 Ready to receive commands`, { parse_mode: "Markdown" });
        });
        // Handle unknown commands
        this.bot.on("message:text", async (ctx) => {
            if (ctx.message.text.startsWith("/")) {
                await ctx.reply("❓ Unknown command. Use /help to see available commands.");
            }
            else {
                await ctx.reply("💡 Tip: Use /ask followed by your question.\n" +
                    "Example: /ask How do I create a class in TypeScript?");
            }
        });
    }
    async stop() {
        await this.server.close();
        this.logger.info("Webhook server stopped");
    }
}
exports.WebhookServer = WebhookServer;
//# sourceMappingURL=webhook-server.js.map