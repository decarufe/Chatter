import { Context } from "grammy";
import { CopilotBridge } from "../core/copilot-bridge";
import { Logger } from "../utils/logger";

export class CommandHandler {
  constructor(
    private copilot: CopilotBridge,
    private logger: Logger,
  ) {}

  async handleAsk(ctx: Context, includeContext: boolean) {
    const question = ctx.message?.text?.split(" ").slice(1).join(" ");

    if (!question || question.trim().length === 0) {
      await ctx.reply(
        "❓ Please provide a question.\n\n" +
          `Example: /${includeContext ? "context" : "ask"} How do I implement error handling?`,
      );
      return;
    }

    this.logger.info(
      `Received ${includeContext ? "/context" : "/ask"}: ${question}`,
    );

    // Send typing indicator
    await ctx.replyWithChatAction("typing");

    try {
      const response = await this.copilot.ask(question, includeContext);

      if (response.error) {
        await ctx.reply(`⚠️ *Error*\n\n${response.error}`, {
          parse_mode: "Markdown",
        });
        return;
      }

      // Format response for Telegram
      const formattedText = this.formatResponse(response.text);

      // Telegram has a 4096 character limit
      if (formattedText.length <= 4096) {
        await ctx.reply(formattedText, { parse_mode: "Markdown" });
      } else {
        // Split into multiple messages
        const chunks = this.splitMessage(formattedText, 4000);
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: "Markdown" });
        }
      }
    } catch (error) {
      this.logger.error("Error handling ask command", error as Error);
      await ctx.reply(
        "❌ An error occurred while processing your request. Check VS Code logs for details.",
      );
    }
  }

  private formatResponse(text: string): string {
    // Escape special Markdown characters for Telegram
    // But preserve code blocks
    let formatted = text;

    // Replace code blocks with placeholders
    const codeBlocks: string[] = [];
    formatted = formatted.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Escape special characters outside code blocks
    formatted = formatted.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      formatted = formatted.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return formatted;
  }

  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    const lines = text.split("\n");

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = "";
        }

        // If a single line is too long, split it
        if (line.length > maxLength) {
          for (let i = 0; i < line.length; i += maxLength) {
            chunks.push(line.substring(i, i + maxLength));
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
