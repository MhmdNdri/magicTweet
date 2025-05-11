# Magic Tweet

A browser extension that suggests paraphrased tweets using AI language models. Enhance your tweets with different tones and styles!

## Features

- Automatically detects tweet text when composing
- Suggests paraphrased versions in different tones:
  - Professional
  - Casual
  - Humorous
  - Empathetic
- Powered by advanced AI language models
- Easy to use interface
- No API key required - ready to use!

## Installation

### From Web Stores

- [Chrome Web Store](https://chrome.google.com/webstore/detail/magic-tweet/...) (Coming Soon)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/magic-tweet/) (Coming Soon)

### Manual Installation

1. Clone this repository:

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

4. Load the extension in your browser:
   - Chrome: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `dist` folder
   - Firefox: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select any file in the `dist` folder

## Development

- Run `pnpm run watch` to automatically rebuild the extension when files change
- The extension files are in the `dist` directory after building
- Source files are in:
  - `scripts/` - JavaScript files
  - `styles/` - CSS files
  - `icons/` - Extension icons
  - `manifest.json` - Extension configuration
  - `popup.html` - Extension popup interface

## Security

- The extension uses a secure, pre-configured API key
- All API communications are encrypted using HTTPS
- No user data is stored or collected
- The API key is embedded during build time and cannot be extracted from the extension

## License

MIT License - feel free to use this project for your own purposes!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
