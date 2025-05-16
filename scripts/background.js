// OpenAI API configuration
const OPENAI_API_KEY = "process.env.OPENAI_API_KEY";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4.1-nano";

// XAI API configuration
const XAI_API_KEY = "process.env.XAI_API_KEY";
const XAI_API_URL = "https://api.x.ai/v1";
const XAI_MODEL = "grok-3-mini-beta";

// Twitter OAuth Configuration
const TWITTER_CLIENT_ID = "U3ZVai1SNEpHdkJnMTFBeEEybmk6MTpjaQ"; // Your provided Client ID
const TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
// Define the scopes your extension needs.
// Common scopes: 'users.read', 'tweet.read', 'tweet.write', 'offline.access' (for refresh token)
const TWITTER_SCOPES = ["users.read", "tweet.read", "offline.access"].join(" ");

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

// PKCE Helper: Generate a random string for the code verifier
function generateCodeVerifier() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return base64urlEncode(randomBytes);
}

// PKCE Helper: Base64URL encode
function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// PKCE Helper: Generate code challenge from verifier
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(digest);
}

let codeVerifierForOAuth;

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TWITTER_LOGIN") {
    (async () => {
      try {
        codeVerifierForOAuth = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifierForOAuth);
        const redirectUri = chrome.identity.getRedirectURL();
        const state = generateCodeVerifier();

        const authParams = new URLSearchParams({
          response_type: "code",
          client_id: TWITTER_CLIENT_ID,
          redirect_uri: redirectUri,
          scope: TWITTER_SCOPES,
          state: state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        });
        const authUrl = `${TWITTER_AUTH_URL}?${authParams.toString()}`;
        console.log("Background: Initiating Twitter OAuth. Auth URL:", authUrl);

        const oauthResponseUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true,
        });
        console.log(
          "Background: OAuth flow completed. Response URL:",
          oauthResponseUrl
        );

        if (chrome.runtime.lastError || !oauthResponseUrl) {
          throw new Error(
            chrome.runtime.lastError?.message ||
              "OAuth flow failed or was cancelled."
          );
        }

        const url = new URL(oauthResponseUrl);
        const returnedState = url.searchParams.get("state");
        const authorizationCode = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          throw new Error(
            `OAuth Error: ${error} - ${
              url.searchParams.get("error_description") || "No description"
            }`
          );
        }
        if (returnedState !== state) {
          throw new Error(
            "OAuth state parameter mismatch. Potential CSRF attack."
          );
        }
        if (!authorizationCode) {
          throw new Error("Authorization code not found in OAuth response.");
        }

        const tokenParams = new URLSearchParams({
          code: authorizationCode,
          grant_type: "authorization_code",
          client_id: TWITTER_CLIENT_ID,
          redirect_uri: redirectUri,
          code_verifier: codeVerifierForOAuth,
        });
        console.log(
          "Background: Exchanging authorization code for token. Verifier:",
          codeVerifierForOAuth
        );

        const tokenResponse = await fetch(TWITTER_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString(),
        });
        const tokenData = await tokenResponse.json();
        console.log("Background: Token response data:", tokenData);

        if (!tokenResponse.ok || tokenData.error) {
          throw new Error(
            tokenData.error_description ||
              tokenData.error ||
              `Failed to fetch tokens: ${tokenResponse.statusText}`
          );
        }

        const {
          access_token,
          refresh_token,
          expires_in,
          scope: granted_scopes,
        } = tokenData;
        if (!access_token) {
          throw new Error("Access token not found in token response.");
        }
        console.log(
          "Background: Access Token obtained:",
          access_token.substring(0, 10) + "..."
        );

        // === Call your AWS Backend for user verification and data sync ===
        const backendApiUrl =
          "https://p2p3zyi369.execute-api.eu-west-2.amazonaws.com/";
        console.log(
          "Background: Calling backend API for login/user-sync:",
          backendApiUrl
        );

        let backendResponseData;
        try {
          const backendResponse = await fetch(backendApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: access_token }), // Lambda defaults to 'login' action
          });
          backendResponseData = await backendResponse.json();

          if (!backendResponse.ok || !backendResponseData.userData) {
            console.error(
              "Background: Backend API call failed or did not return user data.",
              backendResponse.status,
              backendResponseData
            );
            throw new Error(
              `Backend login process failed: ${
                backendResponseData.message ||
                backendResponse.statusText ||
                "Unknown backend error"
              }`
            );
          }
          console.log(
            "Background: Backend API call successful. User data from backend:",
            backendResponseData.userData
          );
        } catch (err) {
          // This catches fetch errors or errors thrown from !backendResponse.ok check
          console.error(
            "Background: Error during backend API call for login:",
            err
          );
          throw new Error(
            `Failed to communicate with backend for login: ${err.message}`
          );
        }

        // If backend call was successful, proceed to store tokens and user info from backend
        const expiresAt = Date.now() + expires_in * 1000;
        const userInfoFromBackend = backendResponseData.userData; // userData is {id_str, screen_name, name, profile_image_url_https}

        // Store tokens and user info (now sourced from backend)
        await chrome.storage.local.set({
          twitter_access_token: access_token,
          twitter_refresh_token: refresh_token,
          twitter_token_expires_at: expiresAt,
          twitter_granted_scopes: granted_scopes,
          twitter_user_info: {
            // Adapt to the structure popup.js expects, if different
            // popup.js currently expects: { id, username, name, profile_image_url }
            id: userInfoFromBackend.id_str,
            username: userInfoFromBackend.screen_name,
            name: userInfoFromBackend.name,
            profile_image_url: userInfoFromBackend.profile_image_url_https,
          },
          // Store login attempt result for popup toast
          lastAuthAction: {
            type: "login",
            status: "success",
            message:
              chrome.i18n.getMessage("loginSuccessMessage") ||
              "Login successful!",
            timestamp: Date.now(),
          },
        });

        console.log(
          "Background: Twitter tokens, granted scopes, and user info (from backend) stored successfully."
        );
        // Send the structured userInfo that popup.js expects
        sendResponse({
          success: true,
          userInfo: {
            id: userInfoFromBackend.id_str,
            username: userInfoFromBackend.screen_name,
            name: userInfoFromBackend.name,
            profile_image_url: userInfoFromBackend.profile_image_url_https,
          },
        });
      } catch (error) {
        // This catches errors from OAuth steps or if backend communication failed as handled above
        console.error(
          "Background: TWITTER_LOGIN handler error:",
          error.message,
          error.stack ? error.stack.substring(0, 300) : ""
        );
        // Store login attempt result for popup toast
        chrome.storage.local.set({
          lastAuthAction: {
            type: "login",
            status: "error",
            message: error.message || chrome.i18n.getMessage("loginFailed"),
            timestamp: Date.now(),
          },
        });
        sendResponse({ error: error.message }); // popup.js doesn't use this directly for toast anymore
      } finally {
        codeVerifierForOAuth = null; // Clear the verifier
      }
    })();
    return true; // Indicates that sendResponse will be called asynchronously.
  } else if (request.action === "generateSuggestions") {
    const toneMessageKey = request.tone; // This is the key like "styleSarcastic"
    const aiProvider = request.aiProvider || "openai"; // Default to OpenAI if not specified

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

    getAISuggestions(request.text, toneForApi, aiProvider) // Pass the English string and AI provider
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

  // CHECK_TWITTER_LOGIN_STATUS handler
  if (request.type === "CHECK_TWITTER_LOGIN_STATUS") {
    (async () => {
      try {
        const result = await chrome.storage.local.get([
          "twitter_access_token",
          "twitter_token_expires_at",
          "twitter_user_info", // Get user info too
        ]);

        const token = result.twitter_access_token;
        const expiresAt = result.twitter_token_expires_at;
        const userInfo = result.twitter_user_info;

        if (token && expiresAt > Date.now()) {
          sendResponse({ isLoggedIn: true, userInfo: userInfo });
        } else {
          // If token expired but we had user info, don't send it as user is not actively logged in
          sendResponse({ isLoggedIn: false });
        }
      } catch (e) {
        console.error("Error checking login status in background:", e);
        sendResponse({ isLoggedIn: false, error: e.message });
      }
    })();
    return true; // Async response
  }

  // TWITTER_LOGOUT handler
  if (request.type === "TWITTER_LOGOUT") {
    (async () => {
      let logoutSuccessful = false;
      let errorMessage = "Logout failed.";

      try {
        const tokenResult = await chrome.storage.local.get([
          "twitter_access_token", // We need the access token to tell the backend what to revoke
        ]);
        const accessTokenToRevoke = tokenResult.twitter_access_token;

        if (accessTokenToRevoke) {
          console.log(
            "Background: Calling backend to revoke Twitter token:",
            accessTokenToRevoke.substring(0, 10) + "..."
          );
          const backendApiUrl =
            "https://p2p3zyi369.execute-api.eu-west-2.amazonaws.com/";

          try {
            const backendResponse = await fetch(backendApiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // You might consider a custom header for action if not in body
                // "X-Action": "logout",
              },
              body: JSON.stringify({
                action: "logout",
                tokenToRevoke: accessTokenToRevoke,
              }),
            });

            const backendData = await backendResponse.json();
            if (backendResponse.ok && backendData.success) {
              console.log(
                "Background: Backend successfully processed token revocation.",
                backendData.message
              );
              // Clear local tokens ONLY if backend was successful
              await chrome.storage.local.remove([
                "twitter_access_token",
                "twitter_refresh_token",
                "twitter_token_expires_at",
                "twitter_granted_scopes",
                "twitter_user_info", // Clear user info on logout
              ]);
              console.log(
                "Background: Local Twitter tokens and user info cleared."
              );
              logoutSuccessful = true;
            } else {
              errorMessage =
                backendData.message ||
                `Backend revocation failed: ${backendResponse.status}`;
              console.warn(
                "Background: Backend reported an issue with token revocation.",
                backendResponse.status,
                errorMessage
              );
            }
          } catch (backendError) {
            errorMessage = `Error calling backend for token revocation: ${backendError.message}`;
            console.error("Background: " + errorMessage, backendError);
          }
        } else {
          // No local token found, so effectively logged out from extension's perspective.
          // We can consider this a "success" for the client-side state.
          console.log(
            "Background: No local Twitter access token found. Already logged out locally."
          );
          logoutSuccessful = true; // Considered success from client state
        }

        // Store logout attempt result for popup toast
        await chrome.storage.local.set({
          lastAuthAction: {
            type: "logout",
            status: logoutSuccessful ? "success" : "error",
            message: logoutSuccessful
              ? chrome.i18n.getMessage("logoutSuccessMessage") ||
                "Logout successful!"
              : errorMessage,
            timestamp: Date.now(),
          },
        });

        if (logoutSuccessful) {
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: errorMessage });
        }
      } catch (e) {
        // General error in the handler itself
        errorMessage = `Twitter Logout Error: ${e.message}`;
        console.error("Background: " + errorMessage, e.stack);
        // Store logout attempt result for popup toast
        chrome.storage.local.set({
          lastAuthAction: {
            type: "logout",
            status: "error",
            message: errorMessage,
            timestamp: Date.now(),
          },
        });
        sendResponse({ success: false, error: errorMessage });
      }
    })();
    return true; // Async response
  }
});

// Get AI suggestions for the tweet
async function getAISuggestions(text, tone, aiProvider) {
  // Ensure English messages are loaded if they haven't been yet (async safety)
  if (Object.keys(englishMessages).length === 0) {
    await loadEnglishMessages();
  }

  if (aiProvider === "openai") {
    if (!OPENAI_API_KEY) {
      console.error("OpenAI API key is missing");
      return { error: chrome.i18n.getMessage("errorApiKeyMissing") };
    }
  } else if (aiProvider === "xai") {
    if (!XAI_API_KEY) {
      console.error("XAI API key is missing");
      // Consider adding a specific i18n message for XAI key missing
      return { error: chrome.i18n.getMessage("errorApiKeyMissing") };
    }
  } else {
    console.error("Invalid AI provider:", aiProvider);
    return { error: "Invalid AI provider specified." }; // Consider i18n
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
4. [Fourth variation]
5. [Fifth variation]`; // Corrected to 5 variations

  try {
    let apiUrl, apiKey, model, requestBody;

    if (aiProvider === "openai") {
      console.log("Sending request to OpenAI API with tone:", tone);
      apiUrl = OPENAI_API_URL;
      apiKey = OPENAI_API_KEY;
      model = OPENAI_MODEL;
      requestBody = {
        model: model,
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
        max_tokens: 300,
      };
    } else {
      // aiProvider === "xai"
      console.log("Sending request to XAI API with tone:", tone);
      apiUrl = XAI_API_URL + "/chat/completions"; // Endpoint for chat completions
      apiKey = XAI_API_KEY;
      model = XAI_MODEL;
      requestBody = {
        model: model,
        messages: [
          {
            role: "system",
            content: `You are a tweet enhancement assistant. Rewrite tweets in a ${tone} tone while maintaining the core message. Ensure each variation is under 280 characters. Write in the same language as the input text. Follow the user\'s specified format for 5 variations.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        // temperature: 0.7, // XAI might have different temperature scaling or might not use it for mini
        // max_tokens: 300, // XAI might have different token limits or calculations
        // reasoning_effort: "low", // Specific to XAI - Temporarily removed for testing default behavior
      };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`Received response from ${aiProvider.toUpperCase()} API`);

    if (!response.ok) {
      const error = await response.json();
      console.error(`${aiProvider.toUpperCase()} API error response:`, error);
      return {
        error:
          error.error?.message ||
          chrome.i18n.getMessage("errorFailedSuggestions"),
        details: error,
      };
    }

    const data = await response.json();
    console.log(`Parsed ${aiProvider.toUpperCase()} API response:`, data);

    if (
      aiProvider === "xai" &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.reasoning_content
    ) {
      console.log(
        "XAI Reasoning Content:",
        data.choices[0].message.reasoning_content
      );
    }

    if (
      !data.choices ||
      !data.choices[0] ||
      !data.choices[0].message ||
      !data.choices[0].message.content
    ) {
      console.error("Invalid API response format:", data);
      return { error: chrome.i18n.getMessage("errorInvalidApiResponse") };
    }

    const suggestionsContent = data.choices[0].message.content;
    // Pass aiProvider (or model name if more specific parsing is needed later) to parseSuggestions if its logic needs to differ.
    // For now, assume XAI can be prompted to return a similar format.
    const suggestions = parseSuggestions(suggestionsContent, tone);
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
  variations.splice(5); // Trim to 5 if more (was 4, should be 5 as per prompt)

  suggestions[tone] = variations;
  console.log("Final suggestions object:", suggestions);
  return suggestions;
}

// You might also want a function to get the stored token
async function getTwitterAccessToken() {
  const result = await chrome.storage.local.get([
    "twitter_access_token",
    "twitter_token_expires_at",
    "twitter_refresh_token",
    "twitter_user_info", // Also retrieve user_info here if needed for other functions
  ]);
  if (chrome.runtime.lastError) {
    console.error("Error retrieving token:", chrome.runtime.lastError);
    return null;
  }

  if (
    result.twitter_access_token &&
    result.twitter_token_expires_at > Date.now()
  ) {
    return result.twitter_access_token;
  } else if (result.twitter_refresh_token) {
    // Implement token refresh logic here if the access token is expired
    console.log("Access token expired or missing, refresh needed.");
    // return await refreshTwitterToken(result.twitter_refresh_token); // You'll need to implement this
    return null; // For now, just indicate refresh is needed
  }
  return null;
}

// TODO: Implement refreshTwitterToken(refreshToken) function
// This function would use the TWITTER_TOKEN_URL with grant_type=refresh_token

console.log("Background script loaded and Twitter OAuth handler ready.");
