const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Read the background script
const backgroundScript = fs.readFileSync(
  path.join(__dirname, "scripts", "background.js"),
  "utf8"
);

const processedScript = backgroundScript.replace(
  "process.env.OPENAI_API_KEY",
  `'${process.env.OPENAI_API_KEY}'`
);

// Create dist directory if it doesn't exist
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}

// Copy all files to dist
fs.cpSync("scripts", "dist/scripts", { recursive: true });
fs.cpSync("styles", "dist/styles", { recursive: true });
fs.cpSync("icons", "dist/icons", { recursive: true });
fs.copyFileSync("manifest.json", "dist/manifest.json");
fs.copyFileSync("popup.html", "dist/popup.html");

// Write the processed background script
fs.writeFileSync(
  path.join(__dirname, "dist", "scripts", "background.js"),
  processedScript
);

console.log("✅ Build completed successfully!");
