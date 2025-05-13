const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Read the background script template
const backgroundScriptPath = path.join(__dirname, "scripts", "background.js");
let backgroundScriptContent = fs.readFileSync(backgroundScriptPath, "utf8");

// Replace placeholders with actual API keys
// Ensure that process.env.OPENAI_API_KEY and process.env.XAI_API_KEY are loaded correctly from your .env file
const openaiApiKey = process.env.OPENAI_API_KEY;
const xaiApiKey = process.env.XAI_API_KEY;

if (!openaiApiKey) {
  console.warn(
    "Warning: OPENAI_API_KEY not found in .env file. Placeholder will remain."
  );
} else {
  // Replace the string placeholder "process.env.OPENAI_API_KEY" (including quotes)
  // with the actual key, also as a string (e.g., "sk-...")
  backgroundScriptContent = backgroundScriptContent.replace(
    '"process.env.OPENAI_API_KEY"', // Note the surrounding quotes in the search string
    `"${openaiApiKey}"` // The replacement is the key, quoted
  );
}

if (!xaiApiKey) {
  console.warn(
    "Warning: XAI_API_KEY not found in .env file. Placeholder will remain."
  );
} else {
  backgroundScriptContent = backgroundScriptContent.replace(
    '"process.env.XAI_API_KEY"', // Note the surrounding quotes in the search string
    `"${xaiApiKey}"` // The replacement is the key, quoted
  );
}

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, "dist");
const distScriptsDir = path.join(distDir, "scripts");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}
if (!fs.existsSync(distScriptsDir)) {
  fs.mkdirSync(distScriptsDir, { recursive: true });
}

// Copy all necessary files to dist, excluding the original background.js from scripts
// to avoid confusion. The processed one will be written.
const sourceScriptsDir = path.join(__dirname, "scripts");
fs.readdirSync(sourceScriptsDir).forEach((file) => {
  if (file !== "background.js") {
    // Don't copy the template background.js
    fs.copyFileSync(
      path.join(sourceScriptsDir, file),
      path.join(distScriptsDir, file)
    );
  }
});

fs.cpSync(path.join(__dirname, "styles"), path.join(distDir, "styles"), {
  recursive: true,
});
fs.cpSync(path.join(__dirname, "icons"), path.join(distDir, "icons"), {
  recursive: true,
});
fs.cpSync(path.join(__dirname, "_locales"), path.join(distDir, "_locales"), {
  recursive: true,
});
fs.copyFileSync(
  path.join(__dirname, "manifest.json"),
  path.join(distDir, "manifest.json")
);
fs.copyFileSync(
  path.join(__dirname, "popup.html"),
  path.join(distDir, "popup.html")
);
// If you have other root files like popup.js, etc., copy them too.

// Write the processed background script to dist/scripts/background.js
fs.writeFileSync(
  path.join(distScriptsDir, "background.js"),
  backgroundScriptContent
);

console.log("✅ Build completed successfully! Output in dist directory.");
