const fs = require("fs");
const path = require("path");
require("dotenv").config();

const distDir = path.join(__dirname, "dist");
const sourceDir = __dirname;

// List of assets to copy
const assets = [
  "styles",
  "icons",
  "_locales",
  "scripts",
  "manifest.json",
  "popup.html",
];

// Ensure dist directory exists and is clean
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy all assets to dist
assets.forEach((asset) => {
  const sourcePath = path.join(sourceDir, asset);
  const destPath = path.join(distDir, asset);
  if (fs.existsSync(sourcePath)) {
    fs.cpSync(sourcePath, destPath, { recursive: true });
  }
});

// --- API Key Injection ---
const backgroundScriptPath = path.join(distDir, "scripts", "background.js");

try {
  let backgroundScriptContent = fs.readFileSync(backgroundScriptPath, "utf8");

  const replacements = {
    '"process.env.OPENAI_API_KEY"': process.env.OPENAI_API_KEY,
    '"process.env.XAI_API_KEY"': process.env.XAI_API_KEY,
  };

  for (const placeholder in replacements) {
    const apiKey = replacements[placeholder];
    if (apiKey) {
      backgroundScriptContent = backgroundScriptContent.replace(
        new RegExp(placeholder, "g"),
        `"${apiKey}"`
      );
    } else {
      console.warn(
        `Warning: API key for ${placeholder} not found in .env file. Placeholder will remain.`
      );
    }
  }

  fs.writeFileSync(backgroundScriptPath, backgroundScriptContent);
} catch (error) {
  console.error(`Error processing background.js: ${error.message}`);
  // Exit with error if we can't process the background script, as the extension will be broken.
  process.exit(1);
}

console.log("✅ Build completed successfully! Output in dist directory.");
