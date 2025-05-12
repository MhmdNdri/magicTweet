// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4.1-nano";

// Helper to load English messages for API prompts
let englishMessages = {};
async function loadEnglishMessages() {
  if (Object.keys(englishMessages).length > 0) return englishMessages;
  try {
    const url = chrome.runtime.getURL(`_locales/en/messages.json`);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch en/messages.json");
    englishMessages = await response.json();
    console.log("Background: Loaded English messages for API prompts.");
    return englishMessages;
  } catch (error) {
    console.error(
      "Background: CRITICAL - Failed to load English messages for API prompts:",
      error
    );
    // Use keys as fallback if loading fails critically
    return null;
  }
}
// Load messages immediately when script starts
loadEnglishMessages();

function getEnglishMessage(key, fallbackKey) {
  const messageData = englishMessages[key];
  // Use the message if available, otherwise use the key itself (which is often descriptive enough)
  return messageData ? messageData.message : fallbackKey;
}

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateSuggestions") {
    const toneMessageKey = request.tone; // This is the key like "styleSarcastic"
    if (!request.text || !toneMessageKey) {
      console.error("Missing required parameters in request:", request);
      sendResponse({
        error: chrome.i18n.getMessage("errorMissingParams"),
        details: { text: !!request.text, tone: !!toneMessageKey },
      });
      return true;
    }

    // Get the English tone string for the API prompt
    const toneForApi = getEnglishMessage(toneMessageKey, toneMessageKey);

    getAISuggestions(request.text, toneForApi) // Pass the English string
      .then((result) => {
        console.log("Sending response:", result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Error in message handler:", error);
        sendResponse({
          error:
            error.message || chrome.i18n.getMessage("errorFailedSuggestions"),
          details: error,
        });
      });
    return true; // Keep the message channel open for async response
  }

  if (request.action === "getMessages") {
    const lang = request.lang || "en"; // Default to English
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch messages for ${lang}: ${response.statusText}`
          );
        }
        return response.json();
      })
      .then((messages) => {
        sendResponse({ messages: messages });
      })
      .catch((error) => {
        console.error(
          `Background: Error fetching messages for ${lang}:`,
          error
        );
        // Attempt fallback to English if failed language wasn't English
        if (lang !== "en") {
          const fallbackUrl = chrome.runtime.getURL(
            `_locales/en/messages.json`
          );
          fetch(fallbackUrl)
            .then((fallbackResponse) => {
              if (!fallbackResponse.ok)
                throw new Error("Failed to fetch fallback English messages");
              return fallbackResponse.json();
            })
            .then((fallbackMessages) =>
              sendResponse({ messages: fallbackMessages, langUsed: "en" })
            )
            .catch((fallbackError) => {
              console.error(
                "Background: Error fetching fallback English messages:",
                fallbackError
              );
              sendResponse({
                error: fallbackError.message || "Failed to fetch any messages",
              });
            });
        } else {
          sendResponse({
            error: error.message || "Failed to fetch English messages",
          });
        }
      });

    return true; // Keep the message channel open for async fetch response
  }
});

// Get AI suggestions for the tweet
async function getAISuggestions(text, tone) {
  // Ensure English messages are loaded if they haven't been yet (async safety)
  if (Object.keys(englishMessages).length === 0) {
    await loadEnglishMessages();
  }

  if (!OPENAI_API_KEY) {
    console.error("API key is missing");
    return { error: chrome.i18n.getMessage("errorApiKeyMissing") };
  }

  if (!text || !tone) {
    console.error("Missing required parameters:", { text, tone });
    return { error: chrome.i18n.getMessage("errorMissingParams") };
  }

  // Use the provided English 'tone' string directly in the prompt
  const prompt = `Rewrite this tweet in a ${tone} tone. Keep each version under 280 characters. Write in the same language as the input. Provide exactly 5 variations:

"${text}"

Format:
1. [First variation]
2. [Second variation]
3. [Third variation]
4. [Fourth variation]`;

  try {
    console.log("Sending request to OpenAI API with tone:", tone);
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a tweet enhancement assistant. Rewrite tweets in a ${tone} tone while maintaining the core message. Always provide exactly 5 variations. Write in the same language as the input text. Keep responses concise and focused.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300, // Reduced for nano model
      }),
    });

    console.log("Received response from API");

    if (!response.ok) {
      const error = await response.json();
      console.error("API error response:", error);
      return {
        error:
          error.error?.message ||
          chrome.i18n.getMessage("errorFailedSuggestions"),
        details: error,
      };
    }

    const data = await response.json();
    console.log("Parsed API response:", data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid API response format:", data);
      return { error: chrome.i18n.getMessage("errorInvalidApiResponse") };
    }

    const suggestions = parseSuggestions(data.choices[0].message.content, tone);
    console.log("Parsed suggestions:", suggestions);

    if (!suggestions || !suggestions[tone] || suggestions[tone].length === 0) {
      console.error("Failed to parse suggestions:", suggestions);
      return { error: chrome.i18n.getMessage("errorParseSuggestions") };
    }

    return { suggestions };
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    console.error("Error stack:", error.stack);
    return {
      error: error.message || chrome.i18n.getMessage("errorFailedSuggestions"),
      details: error,
    };
  }
}

// Function to parse suggestions
function parseSuggestions(content, tone) {
  console.log("Parsing suggestions for tone:", tone);
  console.log("Raw content:", content);

  const suggestions = {};
  const lines = content.split("\n").filter((line) => line.trim());
  const variations = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Remove any numbering or bullet points
    const cleanLine = trimmedLine.replace(/^[\d\.\-\*]+/, "").trim();
    if (cleanLine) {
      variations.push(cleanLine);
    }
  }

  console.log("Extracted variations:", variations);

  // Ensure we have exactly 4 variations
  while (variations.length < 5) {
    variations.push("");
  }
  variations.splice(5); // Trim to 4 if more

  suggestions[tone] = variations;
  console.log("Final suggestions object:", suggestions);
  return suggestions;
}
