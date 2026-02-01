import * as vscode from "vscode";
import { WebhookServer } from "./server/webhook-server";
import { StatusBarManager } from "./ui/status-bar";
import { ConfigManager } from "./utils/config";
import { Logger } from "./utils/logger";

let server: WebhookServer | undefined;
let statusBar: StatusBarManager;
let logger: Logger;

export async function activate(context: vscode.ExtensionContext) {
  logger = new Logger();
  logger.info("Chatter extension activating...");

  statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("chatter.start", () =>
      startServer(context),
    ),
    vscode.commands.registerCommand("chatter.stop", stopServer),
    vscode.commands.registerCommand("chatter.configure", () =>
      configure(context),
    ),
  );

  // Auto-start if configured
  const config = new ConfigManager(context);
  if (await config.isConfigured()) {
    await startServer(context);
  } else {
    vscode.window
      .showInformationMessage(
        'Chatter: Run "Chatter: Configure" to set up your Telegram bot',
        "Configure",
      )
      .then((selection) => {
        if (selection === "Configure") {
          vscode.commands.executeCommand("chatter.configure");
        }
      });
  }
}

async function startServer(context: vscode.ExtensionContext) {
  if (server) {
    vscode.window.showWarningMessage("Chatter server is already running");
    return;
  }

  const config = new ConfigManager(context);
  if (!(await config.isConfigured())) {
    vscode.window.showErrorMessage(
      'Chatter is not configured. Run "Chatter: Configure" first.',
    );
    return;
  }

  try {
    statusBar.setConnecting();
    logger.info("Starting Chatter server...");

    server = new WebhookServer(context, logger);
    await server.start();

    statusBar.setConnected();
    logger.info("Chatter server started successfully");

    if (
      vscode.workspace.getConfiguration("chatter").get("notifications.enabled")
    ) {
      vscode.window.showInformationMessage(
        "Chatter: Server started. Send /start to your bot!",
      );
    }
  } catch (error) {
    statusBar.setDisconnected();
    logger.error("Failed to start server", error as Error);
    vscode.window.showErrorMessage(
      `Chatter: Failed to start server - ${(error as Error).message}`,
    );
    server = undefined;
  }
}

async function stopServer() {
  if (!server) {
    vscode.window.showWarningMessage("Chatter server is not running");
    return;
  }

  try {
    await server.stop();
    server = undefined;
    statusBar.setDisconnected();
    logger.info("Chatter server stopped");
    vscode.window.showInformationMessage("Chatter: Server stopped");
  } catch (error) {
    logger.error("Failed to stop server", error as Error);
    vscode.window.showErrorMessage(
      `Chatter: Failed to stop server - ${(error as Error).message}`,
    );
  }
}

async function configure(context: vscode.ExtensionContext) {
  const config = new ConfigManager(context);

  // Step 1: Bot Token
  const botToken = await vscode.window.showInputBox({
    prompt: "Enter your Telegram Bot Token (from @BotFather)",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.length < 20) {
        return "Bot token is required and should be at least 20 characters";
      }
      return null;
    },
  });

  if (!botToken) {
    return; // User cancelled
  }

  // Step 2: User ID
  const userId = await vscode.window.showInputBox({
    prompt: "Enter your Telegram User ID (get it from @userinfobot)",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || isNaN(Number(value))) {
        return "User ID must be a number";
      }
      return null;
    },
  });

  if (!userId) {
    return; // User cancelled
  }

  // Step 3: Secret Token (optional, auto-generate)
  const secretToken = generateSecretToken();

  // Save configuration
  await config.saveBotToken(botToken);
  await config.saveSecretToken(secretToken);
  await config.saveUserId(Number(userId));

  logger.info("Configuration saved successfully");
  logger.info(`Secret Token: ${secretToken}`);
  logger.info(`Bot User ID: ${userId}`);

  // Show detailed setup instructions
  const message =
    `✅ Chatter configured!\n\n` +
    `Your secret token (save this!):\n${secretToken}\n\n` +
    `Next steps:\n` +
    `1. Run "Chatter: Start Server"\n` +
    `2. Start ngrok: ngrok http 3847\n` +
    `3. Use your secret token in the webhook setup`;

  vscode.window
    .showInformationMessage(message, "Copy Secret")
    .then((selection) => {
      if (selection === "Copy Secret") {
        vscode.env.clipboard.writeText(secretToken);
        vscode.window.showInformationMessage(
          "Secret token copied to clipboard!",
        );
      }
    });
}

function generateSecretToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function deactivate() {
  if (server) {
    server.stop();
  }
}
