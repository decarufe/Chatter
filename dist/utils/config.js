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
exports.ConfigManager = void 0;
const vscode = __importStar(require("vscode"));
class ConfigManager {
    context;
    constructor(context) {
        this.context = context;
    }
    async saveBotToken(token) {
        await this.context.secrets.store("chatter.botToken", token);
    }
    async getBotToken() {
        return await this.context.secrets.get("chatter.botToken");
    }
    async saveSecretToken(token) {
        await this.context.secrets.store("chatter.secretToken", token);
    }
    async getSecretToken() {
        return await this.context.secrets.get("chatter.secretToken");
    }
    async saveUserId(userId) {
        const config = vscode.workspace.getConfiguration("chatter");
        await config.update("telegram.allowedUserId", userId, vscode.ConfigurationTarget.Global);
    }
    getUserId() {
        const config = vscode.workspace.getConfiguration("chatter");
        return config.get("telegram.allowedUserId");
    }
    async isConfigured() {
        const botToken = await this.getBotToken();
        const userId = this.getUserId();
        return !!(botToken && userId);
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config.js.map