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
- Secure API key handling

## Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/magic-tweet.git
cd magic-tweet
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env` file in the root directory and add your API key:

```

```

4. Build the extension:

```bash
pnpm run build
```

5. Load the extension in your browser:
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

- Your API key is stored locally in the `.env` file
- The `.env` file is gitignored to prevent accidental commits
- API key validation is performed during build

## License

MIT License - feel free to use this project for your own purposes!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
