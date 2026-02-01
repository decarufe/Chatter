import * as vscode from "vscode";
import { Logger } from "../utils/logger";

export interface CopilotResponse {
  text: string;
  error?: string;
}

export class CopilotBridge {
  private conversationHistory: vscode.LanguageModelChatMessage[] = [];

  constructor(private logger: Logger) {}

  async ask(
    question: string,
    includeWorkspaceContext: boolean = false,
  ): Promise<CopilotResponse> {
    try {
      // Select Copilot model
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });

      if (models.length === 0) {
        return {
          text: "",
          error:
            "GitHub Copilot is not available. Please ensure you have Copilot installed and activated.",
        };
      }

      const model = models[0];
      this.logger.info(`Using model: ${model.family} (${model.name})`);

      // Build messages
      const messages: vscode.LanguageModelChatMessage[] = [];

      // Add workspace context if requested
      if (includeWorkspaceContext) {
        const context = await this.getWorkspaceContext();
        if (context) {
          messages.push(
            vscode.LanguageModelChatMessage.User(
              `Workspace context:\n${context}\n\nUser question: ${question}`,
            ),
          );
        } else {
          messages.push(vscode.LanguageModelChatMessage.User(question));
        }
      } else {
        // Add conversation history for context
        messages.push(...this.conversationHistory);
        messages.push(vscode.LanguageModelChatMessage.User(question));
      }

      // Send request
      const response = await model.sendRequest(
        messages,
        {},
        new vscode.CancellationTokenSource().token,
      );

      // Stream response
      let result = "";
      for await (const chunk of response.text) {
        result += chunk;
      }

      // Update conversation history
      this.conversationHistory.push(
        vscode.LanguageModelChatMessage.User(question),
      );
      this.conversationHistory.push(
        vscode.LanguageModelChatMessage.Assistant(result),
      );

      // Keep only last 10 messages to avoid context overflow
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      this.logger.info(`Copilot response: ${result.substring(0, 100)}...`);

      return { text: result };
    } catch (error) {
      this.logger.error("Copilot request failed", error as Error);

      if (error instanceof vscode.LanguageModelError) {
        return {
          text: "",
          error: `Copilot error: ${error.message} (${error.code})`,
        };
      }

      return {
        text: "",
        error: `Unexpected error: ${(error as Error).message}`,
      };
    }
  }

  clearHistory() {
    this.conversationHistory = [];
    this.logger.info("Conversation history cleared");
  }

  private async getWorkspaceContext(): Promise<string | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }

    const document = editor.document;
    const fileName = document.fileName;
    const language = document.languageId;
    const selection = editor.selection;

    let context = `File: ${fileName}\nLanguage: ${language}\n`;

    if (!selection.isEmpty) {
      const selectedText = document.getText(selection);
      context += `\nSelected code:\n\`\`\`${language}\n${selectedText}\n\`\`\``;
    } else {
      // Include first 50 lines of current file
      const lineCount = Math.min(document.lineCount, 50);
      const firstLines = document.getText(new vscode.Range(0, 0, lineCount, 0));
      context += `\nFile content (first ${lineCount} lines):\n\`\`\`${language}\n${firstLines}\n\`\`\``;
    }

    return context;
  }
}
