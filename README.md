# Magic Tweet

A browser extension that suggests paraphrased tweets using AI language models. Enhance your tweets with different tones and styles!

## Features

- Automatically detects tweet text when composing
- Suggests paraphrased versions in different tones:
  - Professional
  - Casual
  - Humorous
  - Empathetic
- **Choice between OpenAI GPT and XAI Grok models for suggestions**
- Powered by advanced AI language models
- Easy to use interface
- **For developers building from source, API keys are managed locally and embedded at build time. Users installing from web stores will have a pre-configured version.**

## Installation

### From Web Stores

- [Chrome Web Store](https://chrome.google.com/webstore/detail/magic-tweet/...) (Coming Soon)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/magic-tweet/) (Coming Soon)

### Manual Installation (for Developers)

1. Clone this repository:

```bash
git clone https://github.com/yourusername/magic-tweet.git
cd magic-tweet
```

2. **Set up API Keys:**
   Create a `.env` file in the root of the project. Add your API keys like this:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   XAI_API_KEY=your_xai_api_key_here
   ```

   **Note:** Ensure `.env` is added to your `.gitignore` file to prevent committing your secret keys.

3. Install dependencies:

```bash
pnpm install
```

4. Build the extension:
   This step injects the API keys from your `.env` file.

```bash
node build.js
# or if you have a script in package.json like "build": "node build.js"
pnpm run build
```

5. Load the extension in your browser:
   - Chrome: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `dist` folder.
   - Firefox: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select any file in the `dist` folder (usually `dist/manifest.json`).

## Development

- If you modify files in the `scripts`, `styles`, etc., remember to run the build command (`node build.js` or `pnpm run build`) again to see changes that involve API key injection or file processing for the `dist` directory.
- Consider using a watch script (e.g., with `nodemon`) if you frequently change files that require rebuilding: `pnpm run watch` (if configured in `package.json` to run `node build.js` on changes).
- The extension files are in the `dist` directory after building.
- Source files are in:
  - `scripts/` - JavaScript files (template for `background.js` is here)
  - `styles/` - CSS files
  - `icons/` - Extension icons
  - `manifest.json` - Extension configuration (template is here, copied to `dist`)
  - `popup.html` - Extension popup interface (copied to `dist`)
  - `build.js` - Script for building the extension and injecting API keys.

## Security

- **API Key Management**: For developers building from the source, API keys are sourced from a local `.env` file at build time and embedded into the `dist/scripts/background.js` file. This `.env` file should be kept private and not committed to version control.
- For versions distributed through web stores, API keys will be pre-configured by the developer during the packaging process.
- All API communications are encrypted using HTTPS.
- No user data is stored or collected beyond what's necessary for the API request (the text to be paraphrased and selected tone/provider).

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
