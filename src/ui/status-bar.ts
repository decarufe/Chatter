import * as vscode from "vscode";

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = "chatter.start";
    this.setDisconnected();
    this.statusBarItem.show();
  }

  setConnected() {
    this.statusBarItem.text = "$(radio-tower) Chatter";
    this.statusBarItem.tooltip = "Chatter: Connected to Telegram";
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.command = "chatter.stop";
  }

  setConnecting() {
    this.statusBarItem.text = "$(sync~spin) Chatter";
    this.statusBarItem.tooltip = "Chatter: Connecting...";
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
    this.statusBarItem.command = undefined;
  }

  setDisconnected() {
    this.statusBarItem.text = "$(debug-disconnect) Chatter";
    this.statusBarItem.tooltip = "Chatter: Disconnected - Click to start";
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.command = "chatter.start";
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}
