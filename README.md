# Magic Tweet

A sophisticated browser extension that enhances the Twitter/X experience by providing AI-powered tweet paraphrasing and content suggestions. Built with modern web technologies and cloud infrastructure.

## 📥 **Download Now**

**🔴 Chrome Web Store:** **[Install Magic Tweet](https://chromewebstore.google.com/detail/nmddgmiddifepobdhibipaoehhnkdfmb)**

**🦊 Firefox Add-ons:** **[Install Magic Tweet](https://addons.mozilla.org/en-US/firefox/addon/magic-tweet/)**

## 🎬 Quick Start: Download Videos & GIFs

1. **🔍 Browse Twitter/X** - Videos and GIFs will automatically show a download icon
2. **📥 Click Download** - A modal opens with quality options and video preview
3. **🎯 Select Quality** - Choose your preferred resolution and format
4. **⚡ Download** - File downloads directly to your browser's download folder

_Works on both twitter.com and x.com - no additional setup required!_

## Overview

Magic Tweet seamlessly integrates with Twitter/X to offer intelligent content suggestions and stylistic paraphrasing. The extension leverages advanced AI language models to help users craft more engaging and diverse tweets.

## ✨ Key Features

### 🤖 **AI-Powered Content Enhancement**

- **🎭 AI Paraphrasing**: Transform your tweets using OpenAI GPT and X.AI Grok models
- **🎨 Multiple Stylistic Tones**:
  - 💼 Professional
  - 😊 Casual & Playful
  - 😂 Humorous & Sarcastic
  - 💖 Romantic & Empathetic
  - 🎭 Poetic & Theatrical
  - 🌟 Uplifting & Inspirational
  - 🔥 Roast & Dark Humor

### 🎬 **Video & Media Downloads** _(New Feature)_

- **📥 Smart Video Detection**: Automatically detects videos and GIFs on Twitter/X timeline
- **⚡ Quick Download**: One-click download with quality selection modal
- **🎯 Quality Options**: Choose from multiple video qualities and formats
- **📱 Universal Support**: Works with both x.com and twitter.com URLs
- **🖼️ Preview Thumbnails**: See video preview before downloading
- **💾 Direct Downloads**: Files download directly to your browser's download folder

### 🔧 **Technical Features**

- **🔗 Seamless Integration**: Direct integration with Twitter/X interface
- **🌙 Adaptive UI**: Supports both light and dark themes
- **🌍 Internationalization**: Multi-language support (English/Persian)
- **🔒 Secure Authentication**: Twitter OAuth 2.0 with PKCE
- **☁️ Cloud Infrastructure**: AWS Lambda + Railway backend
- **🚀 Cross-Browser Support**: Works on Chrome and Firefox

## 🏗️ Technical Architecture

- **🌐 Frontend**: Cross-browser Extension (Manifest V3)
- **⚡ AI Backend**: AWS Lambda (Node.js) for tweet enhancement
- **🎬 Video Backend**: Railway-hosted Python API with yt-dlp integration
- **💾 Database**: Amazon DynamoDB
- **🔐 Security**: Twitter OAuth 2.0 with PKCE for secure authentication
- **🧠 AI Integration**: OpenAI GPT and X.AI Grok APIs
- **📥 Video Processing**: yt-dlp for high-quality video extraction
- **🔧 Package Manager**: pnpm for faster builds

## 🚀 Installation

### From Web Stores

**🔴 Chrome Web Store:** **[Install Magic Tweet](https://chromewebstore.google.com/detail/nmddgmiddifepobdhibipaoehhnkdfmb)**

**🦊 Firefox Add-ons:** **[Install Magic Tweet](https://addons.mozilla.org/en-US/firefox/addon/magic-tweet/)**

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

## 👨‍💻 Development

### 📁 Project Structure

```
magic-tweet/
├── dist/                    # 📦 Built extension files (Chrome)
├── dist-firefox/            # 🦊 Built extension files (Firefox)
├── scripts/                 # 📜 Extension scripts
│   ├── background.js        # ⚙️ Background service worker
│   ├── content.js           # 🔗 Content script for Twitter integration
│   └── ui.js               # 🎨 UI components and styling
├── styles/                  # 💄 CSS styles
├── icons/                   # 🖼️ Extension icons
├── _locales/               # 🌍 Internationalization files
├── aws_lambda_functions/    # ☁️ AWS Lambda functions
├── manifest.json           # 📋 Chrome extension manifest
├── manifest-firefox.json   # 🦊 Firefox extension manifest
├── popup.html              # 🪟 Extension popup
├── build.js                # 🔨 Chrome build script
└── build-firefox.js        # 🦊 Firefox build script
```

### 🛠️ Building and Testing

**Build for Chrome:**

```bash
pnpm run build
```

**Build for Firefox:**

```bash
pnpm run build:firefox
```

**Development with auto-reload:**

```bash
pnpm run watch
```

## 🔐 Security

- 🔑 API keys are managed securely through AWS SSM Parameter Store
- 🛡️ Twitter OAuth 2.0 with PKCE for secure authentication
- 🔒 All API communications are encrypted using HTTPS
- 📊 No user data is stored beyond what's necessary for the service
- 🚫 No tracking or analytics beyond essential functionality

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License

## 🔒 Privacy

For detailed information about data handling and privacy, please refer to [PRIVACY.md](PRIVACY.md).

---

## 📈 Version History

- **v1.0.6** - Added video & GIF download feature with quality selection
- **v1.0.5** - Firefox compatibility, improved login UI, cross-browser support
- **v1.0.0** - Initial Chrome release with AI-powered tweet suggestions

**⭐ If you find Magic Tweet helpful, please consider leaving a review on the [Chrome Web Store](https://chromewebstore.google.com/detail/nmddgmiddifepobdhibipaoehhnkdfmb) or [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/magic-tweet/)!**
