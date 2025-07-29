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

// Handle OAuth response for both Chrome and Firefox
async function handleOAuthResponse(
  oauthResponseUrl,
  expectedState,
  sendResponse
) {
  try {
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
    if (returnedState !== expectedState) {
      throw new Error("OAuth state parameter mismatch. Potential CSRF attack.");
    }
    if (!authorizationCode) {
      throw new Error("Authorization code not found in OAuth response.");
    }

    // Get the stored values (needed for Firefox)
    const storage = await chrome.storage.local.get([
      "oauth_code_verifier",
      "oauth_redirect_uri",
    ]);
    const codeVerifier = storage.oauth_code_verifier || codeVerifierForOAuth;
    const redirectUri =
      storage.oauth_redirect_uri || chrome.identity.getRedirectURL();

    const tokenParams = new URLSearchParams({
      code: authorizationCode,
      grant_type: "authorization_code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
    console.log(
      "Background: Exchanging authorization code for token. Verifier:",
      codeVerifier
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
      const backendResponse = await makeRateLimitedRequest(backendApiUrl, {
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
    const userInfoFromBackend = backendResponseData.userData; // userData is {id_str, screen_name, name, profile_image_url_https, number_requests, is_paid, budget, video_downloads_budget, video_downloaded}

    // DETAILED LOGGING (NEW)
    console.log(
      "[DEBUG Background TWITTER_LOGIN] User info from backend to be stored:",
      JSON.stringify(userInfoFromBackend, null, 2)
    );

    // Store tokens and user info (now sourced from backend)
    await chrome.storage.local.set({
      twitter_access_token: access_token,
      twitter_refresh_token: refresh_token,
      twitter_token_expires_at: expiresAt,
      twitter_granted_scopes: granted_scopes,
      twitter_user_info: {
        id: userInfoFromBackend.id_str,
        username: userInfoFromBackend.screen_name,
        name: userInfoFromBackend.name,
        profile_image_url: userInfoFromBackend.profile_image_url_https,
        number_requests: userInfoFromBackend.number_requests,
        is_paid: userInfoFromBackend.is_paid,
        budget: userInfoFromBackend.budget,
        video_downloads_budget: userInfoFromBackend.video_downloads_budget,
        video_downloaded: userInfoFromBackend.video_downloaded,
      },
      // Store login attempt result for popup toast
      lastAuthAction: {
        type: "login",
        status: "success",
        message:
          chrome.i18n.getMessage("loginSuccessMessage") || "Login successful!",
        timestamp: Date.now(),
      },
    });

    // Clean up OAuth storage
    await chrome.storage.local.remove([
      "oauth_state",
      "oauth_code_verifier",
      "oauth_redirect_uri",
    ]);

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
        number_requests: userInfoFromBackend.number_requests,
        is_paid: userInfoFromBackend.is_paid,
        budget: userInfoFromBackend.budget,
        video_downloads_budget: userInfoFromBackend.video_downloads_budget,
        video_downloaded: userInfoFromBackend.video_downloaded,
      },
    });
  } catch (error) {
    // This catches errors from OAuth steps or if backend communication failed as handled above
    console.error(
      "Background: handleOAuthResponse error:",
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
    sendResponse({ success: false, error: error.message });
  } finally {
    codeVerifierForOAuth = null; // Clear the verifier
  }
}

// === CLIENT-SIDE RATE LIMITING ===
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
let consecutiveErrors = 0;
let rateLimitResetTime = null;

function calculateBackoffDelay(attempt) {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds max
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return exponentialDelay + jitter;
}

async function waitForRateLimit() {
  // Check global rate limit
  if (rateLimitResetTime && Date.now() < rateLimitResetTime) {
    const waitTime = rateLimitResetTime - Date.now() + 1000;
    console.log(`Client rate limit active. Waiting ${waitTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  // Ensure minimum interval between requests
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

async function makeRateLimitedRequest(url, options, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await waitForRateLimit();

      const response = await fetch(url, options);

      if (response.status === 429) {
        consecutiveErrors++;

        // Try to get retry-after header
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const waitTime = parseInt(retryAfter) * 1000;
          rateLimitResetTime = Date.now() + waitTime;
          console.log(`Rate limit detected. Retry after: ${waitTime}ms`);
        } else {
          // Use exponential backoff
          const backoffDelay = calculateBackoffDelay(consecutiveErrors);
          rateLimitResetTime = Date.now() + backoffDelay;
          console.log(
            `Rate limit detected. Backing off for: ${backoffDelay}ms`
          );
        }

        if (attempt < maxRetries - 1) {
          attempt++;
          continue;
        } else {
          throw new Error(`Rate limit exceeded. Please try again later.`);
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Request failed with status ${response.status}`
        );
      }

      // Reset on success
      consecutiveErrors = 0;
      rateLimitResetTime = null;

      return response;
    } catch (error) {
      if (
        error.message.includes("Rate limit") ||
        error.message.includes("429")
      ) {
        consecutiveErrors++;

        if (attempt < maxRetries - 1) {
          const backoffDelay = calculateBackoffDelay(attempt);
          console.log(
            `Retrying after ${backoffDelay}ms due to rate limit. Attempt ${
              attempt + 1
            }/${maxRetries}`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          attempt++;
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}

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

        let oauthResponseUrl;

        // Chrome OAuth flow (simplified - no browser detection needed)
        oauthResponseUrl = await chrome.identity.launchWebAuthFlow({
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

        // Continue with token exchange
        await handleOAuthResponse(oauthResponseUrl, state, sendResponse);
      } catch (error) {
        console.error("Background: Error during Twitter OAuth:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep the message channel open for async response
  } else if (request.action === "generateSuggestions") {
    const toneMessageKey = request.tone; // This is the key like "styleSarcastic"
    const tweetText = request.text;

    if (!tweetText || !toneMessageKey) {
      console.error(
        "Background: Missing required parameters in request:",
        request
      );
      sendResponse({
        error: chrome.i18n.getMessage("errorMissingParams"),
        details: { text: !!tweetText, tone: !!toneMessageKey },
      });
      return true;
    }

    // Get the English tone string for the API prompt (Lambda expects this)
    const toneForApi = getEnglishMessage(toneMessageKey, toneMessageKey);

    (async () => {
      try {
        // Fetch AI provider from storage
        const data = await chrome.storage.local.get("magic-tweet-ai-provider");
        const aiProvider = data["magic-tweet-ai-provider"] || "gemini"; // Default to gemini if not set
        console.log("[Background.js] Using AI Provider:", aiProvider); // Log the provider being used

        const userAccessToken = await getValidAccessToken();
        if (!userAccessToken) {
          sendResponse({
            error:
              chrome.i18n.getMessage("errorNotLoggedInForAI") ||
              "Please log in to use AI suggestions.",
            needsLogin: true,
          });
          return;
        }

        const backendApiUrl =
          "https://p2p3zyi369.execute-api.eu-west-2.amazonaws.com/";

        // Use rate-limited request to handle 429 errors
        const backendResponse = await makeRateLimitedRequest(backendApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generateAiSuggestions",
            tweetText: tweetText,
            toneForApi: toneForApi,
            aiProvider: aiProvider,
            accessToken: userAccessToken, // Send user's Twitter token for backend auth check
          }),
        });

        const responseData = await backendResponse.json();

        if (!backendResponse.ok) {
          console.error(
            "Background: Backend AI suggestion call failed.",
            backendResponse.status,
            responseData
          );
          sendResponse({
            error:
              responseData.message ||
              chrome.i18n.getMessage("errorFailedSuggestionsBackend"),
            details: responseData,
          });
          return;
        }

        // Assuming Lambda returns { message: "...", suggestions: "raw string suggestions", updatedUser: { number_requests, is_paid, budget } }
        const parsedSuggestions = parseSuggestions(
          responseData.suggestions,
          toneForApi
        ); // Use toneForApi as key
        console.log(
          "Background: Parsed suggestions from backend:",
          parsedSuggestions
        );

        // After successfully getting suggestions, fetch updated user info
        // to refresh local storage, so popup shows correct remaining count.
        (async () => {
          try {
            const userAccessTokenForRefresh = await getValidAccessToken();
            if (userAccessTokenForRefresh) {
              console.log(
                "Background: Attempting to refresh user info from backend after suggestion generation."
              );
              const refreshResponse = await makeRateLimitedRequest(
                backendApiUrl,
                {
                  // backendApiUrl is already defined in this scope
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "login", // Re-use login action to get full user profile
                    accessToken: userAccessTokenForRefresh,
                  }),
                }
              );
              const refreshData = await refreshResponse.json();
              if (refreshResponse.ok && refreshData.userData) {
                // Perform the same mapping as in the initial login flow
                const mappedRefreshedUserInfo = {
                  id: refreshData.userData.id_str,
                  username: refreshData.userData.screen_name,
                  name: refreshData.userData.name,
                  profile_image_url:
                    refreshData.userData.profile_image_url_https,
                  number_requests: refreshData.userData.number_requests,
                  is_paid: refreshData.userData.is_paid,
                  budget: refreshData.userData.budget,
                };
                await chrome.storage.local.set({
                  twitter_user_info: mappedRefreshedUserInfo, // Store the mapped object
                });
                console.log(
                  "Background: Successfully refreshed local twitter_user_info with latest MAPPED data from backend.",
                  mappedRefreshedUserInfo // Log the mapped object
                );
              } else {
                console.warn(
                  "Background: Failed to refresh user info from backend after suggestion. Status:",
                  refreshResponse.status,
                  "Data:",
                  refreshData
                );
              }
            } else {
              console.warn(
                "Background: No valid access token to refresh user info after suggestion."
              );
            }
          } catch (refreshError) {
            console.error(
              "Background: Error during user info refresh after suggestion:",
              refreshError
            );
          }
        })(); // Self-invoking async function to not block sending suggestions

        // Send suggestions back to the content script immediately.
        // The user info refresh happens in the background.
        sendResponse({ suggestions: parsedSuggestions });
      } catch (error) {
        console.error(
          "Background: Error in generateSuggestions handler:",
          error
        );

        let errorMessage =
          error.message || chrome.i18n.getMessage("errorFailedSuggestions");

        // Provide specific error messages for rate limiting
        if (
          error.message.includes("Rate limit") ||
          error.message.includes("429")
        ) {
          if (error.message.includes("Twitter")) {
            errorMessage =
              chrome.i18n.getMessage("errorTwitterRateLimit") ||
              "Twitter API rate limit reached. Please try again in a few minutes.";
          } else {
            errorMessage =
              chrome.i18n.getMessage("errorRateLimitExceeded") ||
              "Rate limit exceeded. Please wait a moment and try again.";
          }
        } else if (error.message.includes("Too many requests")) {
          errorMessage =
            chrome.i18n.getMessage("errorTooManyRequests") ||
            "Too many requests. Please wait before trying again.";
        } else if (error.message.includes("Max retries exceeded")) {
          errorMessage =
            chrome.i18n.getMessage("errorRetryLater") ||
            "Service temporarily unavailable. Please retry in a few moments.";
        }

        sendResponse({
          error: errorMessage,
          details: error.toString(),
        });
      }
    })();
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
        const accessToken = await getValidAccessToken(); // Use the new function

        if (accessToken) {
          // If we have a valid token, fetch fresh user data from Lambda
          // This ensures we get the latest user info including video download fields
          try {
            console.log("[DEBUG Background CHECK_TWITTER_LOGIN_STATUS] Fetching fresh user data from Lambda...");
            
            const lambdaResponse = await fetch(LAMBDA_ENDPOINT, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "getUserInfo",
                accessToken: accessToken,
              }),
            });

            if (lambdaResponse.ok) {
              const backendResponseData = await lambdaResponse.json();
              const userInfoFromBackend = backendResponseData.userData;
              
              console.log("[DEBUG Background CHECK_TWITTER_LOGIN_STATUS] Fresh user data from Lambda:", 
                JSON.stringify(userInfoFromBackend, null, 2));

              // Update local storage with fresh data
              const userInfo = {
                id: userInfoFromBackend.id_str,
                username: userInfoFromBackend.screen_name,
                name: userInfoFromBackend.name,
                profile_image_url: userInfoFromBackend.profile_image_url_https,
                number_requests: userInfoFromBackend.number_requests,
                is_paid: userInfoFromBackend.is_paid,
                budget: userInfoFromBackend.budget,
                video_downloads_budget: userInfoFromBackend.video_downloads_budget,
                video_downloaded: userInfoFromBackend.video_downloaded,
              };

              await chrome.storage.local.set({
                twitter_user_info: userInfo,
              });

              console.log("[DEBUG Background CHECK_TWITTER_LOGIN_STATUS] Updated storage with fresh user data");

              sendResponse({
                isLoggedIn: true,
                userInfo: userInfo,
              });
            } else {
              // Lambda call failed, fall back to cached data
              console.log("[DEBUG Background CHECK_TWITTER_LOGIN_STATUS] Lambda call failed, using cached data");
              const storedData = await chrome.storage.local.get("twitter_user_info");
              
              sendResponse({
                isLoggedIn: true,
                userInfo: storedData.twitter_user_info,
              });
            }
          } catch (fetchError) {
            // Lambda fetch failed, fall back to cached data
            console.log("[DEBUG Background CHECK_TWITTER_LOGIN_STATUS] Lambda fetch error, using cached data:", fetchError);
            const storedData = await chrome.storage.local.get("twitter_user_info");
            
            sendResponse({
              isLoggedIn: true,
              userInfo: storedData.twitter_user_info,
            });
          }
        } else {
          // If accessToken is null, it means user is not logged in or refresh failed.
          // getValidAccessToken already handles clearing tokens and setting lastAuthAction if refresh failed.
          sendResponse({ isLoggedIn: false });
        }
      } catch (e) {
        // This catch is for unexpected errors in the handler itself or from getValidAccessToken if it throws.
        console.error(
          "Background: Error in CHECK_TWITTER_LOGIN_STATUS handler:",
          e
        );
        // Ensure tokens are cleared if something went really wrong.
        await clearLocalTokensAndLogoutState();
        await chrome.storage.local.set({
          lastAuthAction: {
            type: "logout",
            status: "error",
            message:
              chrome.i18n.getMessage("errorCheckingStatus") ||
              "Error checking login status. Please log in.",
            timestamp: Date.now(),
          },
        });
        sendResponse({ isLoggedIn: false, error: e.message }); // Let popup know about the error.
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

  // Video download handlers
  if (request.action === "getVideoInfo") {
    (async () => {
      try {
        const accessToken = await getValidAccessToken();
        
        const response = await makeRateLimitedRequest(
          "https://p2p3zyi369.execute-api.eu-west-2.amazonaws.com/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "getVideoInfo",
              accessToken: accessToken,
              videoUrl: request.videoUrl,
            }),
          }
        );

        const data = await response.json();
        sendResponse(data);
      } catch (error) {
        console.error("Background: Error getting video info:", error);
        sendResponse({
          success: false,
          error: "Failed to get video information",
          message: error.message,
        });
      }
    })();
    return true; // Async response
  }

  if (request.action === "downloadVideo") {
    (async () => {
      try {
        const accessToken = await getValidAccessToken();
        
        const response = await makeRateLimitedRequest(
          "https://p2p3zyi369.execute-api.eu-west-2.amazonaws.com/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "downloadVideo",
              accessToken: accessToken,
              videoUrl: request.videoUrl,
              formatId: request.formatId,
            }),
          }
        );

        const data = await response.json();
        
        // If the download was successful and includes updated budget info,
        // update the stored user info
        if (data.user_video_budget) {
          try {
            const storedData = await chrome.storage.local.get("twitter_user_info");
            if (storedData.twitter_user_info) {
              storedData.twitter_user_info.video_downloads_budget = data.user_video_budget.video_downloads_budget;
              storedData.twitter_user_info.video_downloaded = data.user_video_budget.video_downloaded;
              await chrome.storage.local.set({
                twitter_user_info: storedData.twitter_user_info
              });
              console.log("Background: Updated stored user video budget info");
            }
          } catch (error) {
            console.error("Background: Error updating stored user video budget info:", error);
          }
        }
        
        sendResponse(data);
      } catch (error) {
        console.error("Background: Error starting download:", error);
        sendResponse({
          success: false,
          error: "Failed to start download",
          message: error.message,
        });
      }
    })();
    return true; // Async response
  }

  if (request.action === "getDownloadProgress") {
    (async () => {
      try {
        const response = await fetch(
          `https://web-production-5536a.up.railway.app/progress/${request.progressId}`
        );
        const data = await response.json();
        sendResponse(data);
      } catch (error) {
        console.error("Background: Error getting download progress:", error);
        sendResponse({
          status: "error",
          message: "Failed to get download progress",
        });
      }
    })();
    return true; // Async response
  }

  // Direct file download handler
  if (request.action === "downloadFile") {
    (async () => {
      try {
        const downloadId = await chrome.downloads.download({
          url: request.url,
          filename: request.filename,
          saveAs: false, // Don't show save dialog
        });

        sendResponse({
          success: true,
          downloadId: downloadId,
          filename: request.filename,
        });
      } catch (error) {
        console.error("Background: Error starting file download:", error);
        sendResponse({
          success: false,
          error: "Failed to start download",
          message: error.message,
        });
      }
    })();
    return true; // Async response
  }

  // Video file download handler - ensures authenticated access to downloaded video files
  if (request.action === "downloadVideoFile") {
    (async () => {
      try {
        // Check if user is authenticated (same pattern as video download handlers)
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
          sendResponse({
            success: false,
            error: "authentication_required",
            message: "Please log in to download video files",
          });
          return;
        }

        // Create download URL for the video file
        const downloadUrl = `${
          "https://web-production-5536a.up.railway.app"
        }/download_file/${encodeURIComponent(request.filename)}`;

        sendResponse({
          success: true,
          downloadUrl: downloadUrl,
          message: "Download URL generated successfully",
        });
      } catch (error) {
        console.error("Background: Error generating video file download URL:", error);
        sendResponse({
          success: false,
          error: "Failed to generate download URL",
          message: error.message,
        });
      }
    })();
    return true; // Async response
  }

  // Handle opening popup request
  if (request.action === "openPopup") {
    try {
      chrome.action.openPopup();
      sendResponse({ success: true });
    } catch (error) {
      console.log("Background: Could not open popup programmatically:", error.message);
      sendResponse({ success: false, message: "Please click the extension icon manually" });
    }
    return true;
  }

  // Handle checking authentication status
  if (request.action === "checkAuthStatus") {
    (async () => {
      try {
        const accessToken = await getValidAccessToken();
        sendResponse({ isAuthenticated: !!accessToken });
      } catch (error) {
        console.error("Background: Error checking auth status:", error);
        sendResponse({ isAuthenticated: false });
      }
    })();
    return true; // Async response
  }
});

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

  // Ensure we have exactly 5 variations
  while (variations.length < 5) {
    variations.push("");
  }
  variations.splice(5); // Trim to 5 if more

  suggestions[tone] = variations;
  console.log("Final suggestions object:", suggestions);
  return suggestions;
}

// Helper function to clear all Twitter-related tokens and user info from storage
async function clearLocalTokensAndLogoutState() {
  console.log("Background: Clearing all local Twitter tokens and user info.");
  await chrome.storage.local.remove([
    "twitter_access_token",
    "twitter_refresh_token",
    "twitter_token_expires_at",
    "twitter_granted_scopes",
    "twitter_user_info",
    "lastAuthAction", // Also clear any pending toast messages from previous state
  ]);
  // Optionally, notify popup or other parts of the extension that user is logged out
  // For now, the next CHECK_TWITTER_LOGIN_STATUS will reflect this.
}

// Function to call the backend to refresh the Twitter access token
async function refreshTwitterAccessToken(currentRefreshToken) {
  if (!currentRefreshToken) {
    console.warn(
      "Background: refreshTwitterAccessToken called without a refresh token."
    );
    return { success: false, error: "No refresh token available." };
  }

  console.log(
    "Background: Attempting to refresh Twitter access token via backend."
  );
  const backendApiUrl =
    "https://p2p3zyi369.execute-api.eu-west-2.amazonaws.com/";

  try {
    const backendResponse = await fetch(backendApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refreshToken",
        refreshToken: currentRefreshToken,
      }),
    });

    const responseData = await backendResponse.json();

    if (!backendResponse.ok || !responseData.access_token) {
      console.error(
        "Background: Backend refresh token call failed or did not return new access token.",
        backendResponse.status,
        responseData
      );
      // If refresh fails (e.g., token revoked by user, or other critical error from backend)
      // it might be a good idea to clear local tokens as the refresh token might be invalid.
      // The caller (getValidAccessToken) will typically handle this.
      throw new Error(
        responseData.message || "Failed to refresh token via backend."
      );
    }

    console.log(
      "Background: Successfully refreshed token via backend. New token data:",
      responseData
    );

    const {
      access_token,
      expires_in,
      refresh_token: new_refresh_token,
      scope: new_scopes,
    } = responseData;
    const newExpiresAt = Date.now() + expires_in * 1000;

    const itemsToStore = {
      twitter_access_token: access_token,
      twitter_token_expires_at: newExpiresAt,
      // Only update refresh token if a new one is provided by Twitter
      ...(new_refresh_token && { twitter_refresh_token: new_refresh_token }),
      // Update scopes if provided, otherwise keep existing (or clear if policy dictates)
      ...(new_scopes && { twitter_granted_scopes: new_scopes }),
    };

    await chrome.storage.local.set(itemsToStore);
    console.log(
      "Background: Stored new access token, expiry, and potentially new refresh token."
    );

    return { success: true, newAccessToken: access_token };
  } catch (error) {
    console.error(
      "Background: Error in refreshTwitterAccessToken:",
      error.message
    );
    // The getValidAccessToken function will handle clearing tokens if this fails critically.
    return { success: false, error: error.message };
  }
}

// Function to get a currently valid access token, refreshing if necessary
async function getValidAccessToken() {
  const storedData = await chrome.storage.local.get([
    "twitter_access_token",
    "twitter_refresh_token",
    "twitter_token_expires_at",
  ]);

  const {
    twitter_access_token: accessToken,
    twitter_refresh_token: refreshToken,
    twitter_token_expires_at: expiresAt,
  } = storedData;

  if (!accessToken) {
    console.log("Background: No access token found. User needs to log in.");
    await clearLocalTokensAndLogoutState(); // Ensure clean state
    return null;
  }

  // Check if token is expired or nearing expiry (e.g., within next 5 minutes)
  const bufferMilliseconds = 5 * 60 * 1000; // 5 minutes
  if (Date.now() >= expiresAt - bufferMilliseconds) {
    console.log(
      "Background: Access token expired or nearing expiry. Attempting refresh."
    );
    if (!refreshToken) {
      console.warn(
        "Background: Access token expired, but no refresh token available to renew. Clearing tokens."
      );
      await clearLocalTokensAndLogoutState();
      return null;
    }

    const refreshResult = await refreshTwitterAccessToken(refreshToken);
    if (refreshResult.success && refreshResult.newAccessToken) {
      console.log(
        "Background: Token successfully refreshed. Returning new access token."
      );
      return refreshResult.newAccessToken;
    } else {
      console.error(
        "Background: Failed to refresh access token. Clearing local tokens.",
        refreshResult.error
      );
      await clearLocalTokensAndLogoutState();
      // Store a lastAuthAction to inform popup about the forced logout due to refresh failure
      await chrome.storage.local.set({
        lastAuthAction: {
          type: "logout", // Effectively a logout
          status: "error",
          message:
            chrome.i18n.getMessage("sessionExpiredRefreshFailed") ||
            "Session expired. Please log in again.",
          timestamp: Date.now(),
        },
      });
      return null;
    }
  } else {
    console.log("Background: Existing access token is valid.");
    return accessToken;
  }
}
