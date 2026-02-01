import * as vscode from "vscode";

export class ConfigManager {
  constructor(private context: vscode.ExtensionContext) {}

  async saveBotToken(token: string): Promise<void> {
    await this.context.secrets.store("chatter.botToken", token);
  }

  async getBotToken(): Promise<string | undefined> {
    return await this.context.secrets.get("chatter.botToken");
  }

  async saveSecretToken(token: string): Promise<void> {
    await this.context.secrets.store("chatter.secretToken", token);
  }

  async getSecretToken(): Promise<string | undefined> {
    return await this.context.secrets.get("chatter.secretToken");
  }

  async saveUserId(userId: number): Promise<void> {
    const config = vscode.workspace.getConfiguration("chatter");
    await config.update(
      "telegram.allowedUserId",
      userId,
      vscode.ConfigurationTarget.Global,
    );
  }

  getUserId(): number | undefined {
    const config = vscode.workspace.getConfiguration("chatter");
    return config.get("telegram.allowedUserId");
  }

  async isConfigured(): Promise<boolean> {
    const botToken = await this.getBotToken();
    const userId = this.getUserId();
    return !!(botToken && userId);
  }
}
