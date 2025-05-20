# Magic Tweet

A sophisticated browser extension that enhances the Twitter/X experience by providing AI-powered tweet paraphrasing and content suggestions. Built with modern web technologies and cloud infrastructure.

## Overview

Magic Tweet seamlessly integrates with Twitter/X to offer intelligent content suggestions and stylistic paraphrasing. The extension leverages advanced AI language models to help users craft more engaging and diverse tweets.

## Key Features

- **AI-Powered Paraphrasing**: Transform your tweets using OpenAI GPT and X.AI Grok models
- **Multiple Stylistic Tones**:
  - Professional
  - Casual
  - Humorous
  - Empathetic
  - Sarcastic
  - Playful
  - Romantic
  - Poetic
  - Uplifting
  - Theatrical
- **Seamless Integration**: Direct integration with Twitter/X interface
- **Adaptive UI**: Supports both light and dark themes
- **Internationalization**: Multi-language support
- **Secure Authentication**: Twitter OAuth 2.0 with PKCE
- **Cloud Infrastructure**: AWS Lambda backend with DynamoDB

## Technical Architecture

- **Frontend**: Chrome Extension (Manifest V3)
- **Backend**: AWS Lambda (Node.js)
- **Database**: Amazon DynamoDB
- **Security**: Twitter OAuth 2.0 with PKCE for secure authentication. API keys for AI services are embedded within the AWS Lambda function.
- **Authentication**: Twitter OAuth 2.0 with PKCE
- **AI Integration**: OpenAI GPT and X.AI Grok APIs

## Installation

### From Web Stores

Coming Soon

### Development Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/magic-tweet.git
cd magic-tweet
```

2. Install dependencies:

```bash
pnpm install
```

3. Build the extension:

```bash
pnpm run build
```

4. Load the extension:

- Chrome: Navigate to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `dist` directory
- Firefox: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select `dist/manifest.json`

## Development

### Project Structure

```
magic-tweet/
├── dist/               # Built extension files
├── scripts/           # Extension scripts
│   ├── background.js  # Background service worker
│   ├── content.js     # Content script for Twitter integration
│   └── ui.js         # UI components and styling
├── styles/           # CSS styles
├── icons/           # Extension icons
├── _locales/        # Internationalization files
├── aws_lambda_functions/  # AWS Lambda functions
├── manifest.json    # Extension manifest
├── popup.html      # Extension popup
└── build.js        # Build script
```

### Building and Testing

- Run the build script to compile the extension:

```bash
pnpm run build
```

- For development with auto-reload:

```bash
pnpm run watch
```

## Security

- API keys are managed securely through AWS SSM Parameter Store
- Twitter OAuth 2.0 with PKCE for secure authentication
- All API communications are encrypted using HTTPS
- No user data is stored beyond what's necessary for the service

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Privacy

For detailed information about data handling and privacy, please refer to [PRIVACY.md](PRIVACY.md).
