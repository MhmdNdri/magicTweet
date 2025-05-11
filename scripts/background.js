// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4.1-nano";

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Magic Tweet: Background script received message:", request);
  console.log("Magic Tweet: Message sender:", sender);

  if (request.action === "generateSuggestions") {
    if (!request.text || !request.tone) {
      console.error("Missing required parameters in request:", request);
      sendResponse({
        error: "Missing required parameters",
        details: { text: !!request.text, tone: !!request.tone },
      });
      return true;
    }

    getAISuggestions(request.text, request.tone)
      .then((result) => {
        console.log("Sending response:", result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Error in message handler:", error);
        sendResponse({
          error: error.message || "Failed to generate suggestions",
          details: error,
        });
      });
    return true; // Keep the message channel open for async response
  }
});

// Function to get suggestions from the API
async function getSuggestions(tweetText, tone) {
  console.log("Magic Tweet: Getting suggestions for tone:", tone);

  try {
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
            content: `You are a helpful assistant that paraphrases tweets in a ${tone} tone. Keep the same meaning but adjust the style.`,
          },
          {
            role: "user",
            content: `Please provide 3 different paraphrases of this tweet in a ${tone} tone: "${tweetText}"`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Magic Tweet: API error response:", error);
      throw new Error(error.error?.message || "API request failed");
    }

    const data = await response.json();
    console.log("Magic Tweet: API response:", data);

    const suggestions = data.choices[0].message.content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+\.\s*/, "").trim());

    return suggestions;
  } catch (error) {
    console.error("Magic Tweet: Error in getSuggestions:", error);
    throw error;
  }
}

// Get AI suggestions for the tweet
async function getAISuggestions(text, tone) {
  console.log("Generating suggestions for text:", text);
  console.log("Selected tone:", tone);

  if (!OPENAI_API_KEY) {
    console.error("OpenAI API key is missing");
    return { error: "OpenAI API key is missing" };
  }

  if (!text || !tone) {
    console.error("Missing required parameters:", { text, tone });
    return { error: "Missing required parameters" };
  }

  const prompt = `Rewrite this tweet in a ${tone} tone. Keep each version under 280 characters. Write in the same language as the input. Provide exactly 4 variations:

"${text}"

Format:
1. [First variation]
2. [Second variation]
3. [Third variation]
4. [Fourth variation]`;

  try {
    console.log("Sending request to OpenAI API...");
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
            content: `You are a tweet enhancement assistant. Rewrite tweets in a ${tone} tone while maintaining the core message. Always provide exactly 4 variations. Write in the same language as the input text. Keep responses concise and focused.`,
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

    console.log("Received response from OpenAI API");

    if (!response.ok) {
      const error = await response.json();
      console.error("OpenAI API error response:", error);
      return {
        error: error.error?.message || "Failed to generate suggestions",
        details: error,
      };
    }

    const data = await response.json();
    console.log("Parsed API response:", data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid API response format:", data);
      return { error: "Invalid response format from API" };
    }

    const suggestions = parseSuggestions(data.choices[0].message.content, tone);
    console.log("Parsed suggestions:", suggestions);

    if (!suggestions || !suggestions[tone] || suggestions[tone].length === 0) {
      console.error("Failed to parse suggestions:", suggestions);
      return { error: "Failed to parse suggestions" };
    }

    return { suggestions };
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    console.error("Error stack:", error.stack);
    return {
      error: error.message || "Failed to generate suggestions",
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
  while (variations.length < 4) {
    variations.push("");
  }
  variations.splice(4); // Trim to 4 if more

  suggestions[tone] = variations;
  console.log("Final suggestions object:", suggestions);
  return suggestions;
}
