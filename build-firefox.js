const fs = require("fs");
const path = require("path");
require("dotenv").config();

const distDir = path.join(__dirname, "dist-firefox");
const sourceDir = __dirname;

// List of assets to copy
const assets = ["styles", "icons", "_locales", "scripts", "popup.html"];

console.log("Starting Firefox build...");

// Ensure dist directory exists and is clean
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log("✓ Cleaned existing dist-firefox directory");
}
fs.mkdirSync(distDir, { recursive: true });
console.log("✓ Created dist-firefox directory");

// Copy all assets to dist
assets.forEach((asset) => {
  const sourcePath = path.join(sourceDir, asset);
  const destPath = path.join(distDir, asset);
  if (fs.existsSync(sourcePath)) {
    fs.cpSync(sourcePath, destPath, { recursive: true });
    console.log(`✓ Copied ${asset}`);
  } else {
    console.warn(`⚠️  ${asset} not found, skipping`);
  }
});

// Copy Firefox-specific manifest
const firefoxManifestPath = path.join(sourceDir, "manifest-firefox.json");
const destManifestPath = path.join(distDir, "manifest.json");

if (fs.existsSync(firefoxManifestPath)) {
  fs.copyFileSync(firefoxManifestPath, destManifestPath);
  console.log("✓ Used Firefox-specific manifest");
} else {
  console.error("❌ Firefox manifest not found!");
  process.exit(1);
}

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
      console.log(
        `✓ Injected ${placeholder
          .replace('"process.env.', "")
          .replace('"', "")}`
      );
    } else {
      console.warn(
        `⚠️  Warning: API key for ${placeholder} not found in .env file. Placeholder will remain.`
      );
    }
  }

  fs.writeFileSync(backgroundScriptPath, backgroundScriptContent);
  console.log("✓ Processed background.js");
} catch (error) {
  console.error(`❌ Error processing background.js: ${error.message}`);
  // Exit with error if we can't process the background script, as the extension will be broken.
  process.exit(1);
}

console.log(
  "✅ Firefox build completed successfully! Output in dist-firefox directory."
);
console.log(
  "📁 You can now load the extension from: dist-firefox/manifest.json"
);
