# Chatter - Remote Copilot Control

Control GitHub Copilot Chat in VS Code from anywhere via Telegram.

## Features

- 🤖 **Ask Copilot anything** via Telegram
- 📱 **Remote access** - control from your phone
- 💬 **Conversation memory** - Copilot remembers context
- 🔒 **Secure** - only your Telegram account can access
- 🎯 **Context-aware** - can include your current code

## Quick Start

### 1. Install Extension

Install from VS Code Marketplace or:

```bash
code --install-extension chatter-0.1.0.vsix
```

### 2. Create Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token you receive

### 3. Get Your User ID

1. Message [@userinfobot](https://t.me/userinfobot)
2. Copy your user ID

### 4. Configure Chatter

1. In VS Code: `Cmd/Ctrl+Shift+P` → "Chatter: Configure"
2. Paste your bot token
3. Enter your user ID

### 5. Start Server

1. `Cmd/Ctrl+Shift+P` → "Chatter: Start Server"
2. Expose the webhook using ngrok:
   ```bash
   ngrok http 3847
   ```
3. Set the webhook on Telegram:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<NGROK_URL>/webhook&secret_token=<YOUR_SECRET>"
   ```

### 6. Test It!

Open your bot in Telegram and send:

```
/start
```

Then try:

```
/ask How do I create a TypeScript interface?
```

## Commands

| Command               | Description                   |
| --------------------- | ----------------------------- |
| `/start`              | Initialize connection         |
| `/ask <question>`     | Ask Copilot anything          |
| `/context <question>` | Ask with current file context |
| `/clear`              | Clear conversation history    |
| `/status`             | Check connection status       |
| `/help`               | Show help message             |

## Examples

**Basic question:**

```
/ask What's the difference between const and let?
```

**With context:**

```
/context How can I improve this function?
```

**Follow-up:**

```
/ask Can you show me an example?
```

## Security

- Your bot token is stored in VS Code's secure storage
- Only your Telegram user ID can send commands
- Webhook endpoints require a secret token
- All communication is over HTTPS

## Requirements

- VS Code 1.85.0 or higher
- GitHub Copilot subscription
- Telegram account
- ngrok or similar tunnel service (for webhook)

## Known Limitations

- VS Code must be running for the bot to work
- One active workspace at a time
- Conversation history limited to last 10 messages

## Troubleshooting

**Bot not responding?**

- Check status bar (should show 🟢)
- Check webhook is set correctly
- Check VS Code Output → Chatter for logs

**"Copilot not available" error?**

- Ensure GitHub Copilot extension is installed
- Ensure you're signed in to GitHub
- Check Copilot is activated

**Unauthorized errors?**

- Verify your user ID is correct
- Check bot token is valid
- Ensure webhook secret token matches

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package
npm run package
```

## License

MIT

## Contributing

Issues and PRs welcome at [github.com/decarufe/Chatter](https://github.com/decarufe/Chatter)
