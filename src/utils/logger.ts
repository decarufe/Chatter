import * as vscode from "vscode";

export class Logger {
  private output: vscode.OutputChannel;

  constructor() {
    this.output = vscode.window.createOutputChannel("Chatter");
  }

  info(message: string, meta?: object) {
    this.log("INFO", message, meta);
  }

  warn(message: string, meta?: object) {
    this.log("WARN", message, meta);
  }

  error(message: string, error?: Error) {
    const meta = error
      ? { message: error.message, stack: error.stack }
      : undefined;
    this.log("ERROR", message, meta);
  }

  private log(level: string, message: string, meta?: object) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}`;

    if (meta) {
      this.output.appendLine(`${line} ${JSON.stringify(meta)}`);
    } else {
      this.output.appendLine(line);
    }
  }

  show() {
    this.output.show();
  }
}
