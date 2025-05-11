require("dotenv").config();

function validateApiKey(apiKey) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in .env file");
  }

  // OpenAI API keys start with 'sk-' and are 51 characters long
  const apiKeyPattern = /^sk-[A-Za-z0-9]{48}$/;
  if (!apiKeyPattern.test(apiKey)) {
    throw new Error(
      'Invalid OPENAI_API_KEY format. It should start with "sk-" followed by 48 characters'
    );
  }

  return true;
}

try {
  validateApiKey(process.env.OPENAI_API_KEY);
  console.log("✅ Environment variables validated successfully");
} catch (error) {
  console.error("❌ Environment validation failed:", error.message);
  process.exit(1);
}
