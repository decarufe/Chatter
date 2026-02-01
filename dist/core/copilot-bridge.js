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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotBridge = void 0;
const vscode = __importStar(require("vscode"));
class CopilotBridge {
    logger;
    conversationHistory = [];
    constructor(logger) {
        this.logger = logger;
    }
    async ask(question, includeWorkspaceContext = false) {
        try {
            // Select Copilot model
            const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
            if (models.length === 0) {
                return {
                    text: "",
                    error: "GitHub Copilot is not available. Please ensure you have Copilot installed and activated.",
                };
            }
            const model = models[0];
            this.logger.info(`Using model: ${model.family} (${model.name})`);
            // Build messages
            const messages = [];
            // Add workspace context if requested
            if (includeWorkspaceContext) {
                const context = await this.getWorkspaceContext();
                if (context) {
                    messages.push(vscode.LanguageModelChatMessage.User(`Workspace context:\n${context}\n\nUser question: ${question}`));
                }
                else {
                    messages.push(vscode.LanguageModelChatMessage.User(question));
                }
            }
            else {
                // Add conversation history for context
                messages.push(...this.conversationHistory);
                messages.push(vscode.LanguageModelChatMessage.User(question));
            }
            // Send request
            const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            // Stream response
            let result = "";
            for await (const chunk of response.text) {
                result += chunk;
            }
            // Update conversation history
            this.conversationHistory.push(vscode.LanguageModelChatMessage.User(question));
            this.conversationHistory.push(vscode.LanguageModelChatMessage.Assistant(result));
            // Keep only last 10 messages to avoid context overflow
            if (this.conversationHistory.length > 10) {
                this.conversationHistory = this.conversationHistory.slice(-10);
            }
            this.logger.info(`Copilot response: ${result.substring(0, 100)}...`);
            return { text: result };
        }
        catch (error) {
            this.logger.error("Copilot request failed", error);
            if (error instanceof vscode.LanguageModelError) {
                return {
                    text: "",
                    error: `Copilot error: ${error.message} (${error.code})`,
                };
            }
            return {
                text: "",
                error: `Unexpected error: ${error.message}`,
            };
        }
    }
    clearHistory() {
        this.conversationHistory = [];
        this.logger.info("Conversation history cleared");
    }
    async getWorkspaceContext() {
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
        }
        else {
            // Include first 50 lines of current file
            const lineCount = Math.min(document.lineCount, 50);
            const firstLines = document.getText(new vscode.Range(0, 0, lineCount, 0));
            context += `\nFile content (first ${lineCount} lines):\n\`\`\`${language}\n${firstLines}\n\`\`\``;
        }
        return context;
    }
}
exports.CopilotBridge = CopilotBridge;
//# sourceMappingURL=copilot-bridge.js.map