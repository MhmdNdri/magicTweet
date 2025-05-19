const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { SSMClient, GetParametersCommand } = require("@aws-sdk/client-ssm");
const { TwitterApi } = require("twitter-api-v2");

const LAMBDA_CODE_VERSION = "v2.0.6_MAINTAIN_INPUT_LANGUAGE";

const region = process.env.AWS_REGION || "eu-west-2";
const ddbClient = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const ssmClient = new SSMClient({ region });

const USERS_TABLE_NAME = "Users";
const TWITTER_API_KEY_SSM_NAME = "/my-extension/twitter/api-key";
const TWITTER_API_SECRET_SSM_NAME = "/my-extension/twitter/api-key-secret";
const OPENAI_API_KEY_SSM_NAME = "/my-extension/openai/api-key";
const XAI_API_KEY_SSM_NAME = "/my-extension/xai/api-key";

const MAX_GENERATION_REQUESTS = 150;

const TWITTER_TOKEN_ENDPOINT = "https://api.twitter.com/2/oauth2/token";
const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

let twitterAppClientCredentials = null;
let openAiApiKey = null;
let xAiApiKey = null;

// Function to get Twitter App Client ID and Secret from SSM
async function getTwitterAppClientCredentials() {
  if (twitterAppClientCredentials) {
    return twitterAppClientCredentials;
  }
  try {
    console.log(
      `Fetching Twitter App credentials from SSM. Names: ${TWITTER_API_KEY_SSM_NAME}, ${TWITTER_API_SECRET_SSM_NAME}`
    );
    const command = new GetParametersCommand({
      Names: [TWITTER_API_KEY_SSM_NAME, TWITTER_API_SECRET_SSM_NAME],
      WithDecryption: true, // Important if secrets are SecureString
    });
    const { Parameters, InvalidParameters } = await ssmClient.send(command);

    console.log(
      "SSM GetParameters response received. Parameters:",
      JSON.stringify(Parameters, null, 2),
      "InvalidParameters:",
      JSON.stringify(InvalidParameters, null, 2)
    );

    if (InvalidParameters && InvalidParameters.length > 0) {
      console.error(
        `Could not find the following SSM parameters (InvalidParameters): ${InvalidParameters.join(
          ", "
        )}. Searched for: ${TWITTER_API_KEY_SSM_NAME}, ${TWITTER_API_SECRET_SSM_NAME}`
      );
      throw new Error(
        `Could not find SSM parameters: ${InvalidParameters.join(", ")}`
      );
    }

    if (!Parameters || Parameters.length === 0) {
      console.error(
        "SSM GetParameters returned no Parameters array or an empty one."
      );
      throw new Error("SSM GetParameters returned no Parameters.");
    }

    const apiKeyParam = Parameters.find(
      (p) => p.Name === TWITTER_API_KEY_SSM_NAME
    );
    const apiSecretParam = Parameters.find(
      (p) => p.Name === TWITTER_API_SECRET_SSM_NAME
    );

    console.log(
      "Attempting to find parameters in response. apiKeyParam found:",
      !!apiKeyParam,
      "apiSecretParam found:",
      !!apiSecretParam
    );

    if (!apiKeyParam || !apiSecretParam) {
      let missingParams = [];
      if (!apiKeyParam) missingParams.push(TWITTER_API_KEY_SSM_NAME);
      if (!apiSecretParam) missingParams.push(TWITTER_API_SECRET_SSM_NAME);
      console.error(
        `Twitter API Key or Secret not found in returned SSM Parameters. Missing: ${missingParams.join(
          ", "
        )}. All parameters returned:`,
        JSON.stringify(Parameters, null, 2)
      );
      throw new Error("Twitter API Key or Secret not found in SSM parameters.");
    }
    twitterAppClientCredentials = {
      clientId: apiKeyParam.Value,
      clientSecret: apiSecretParam.Value,
    };
    console.log("Successfully fetched and cached Twitter App credentials.");
    return twitterAppClientCredentials;
  } catch (error) {
    console.error("Error fetching Twitter App credentials from SSM:", error);
    throw new Error( // Re-throw a generic error to avoid exposing too much detail
      "Failed to retrieve Twitter application credentials for revocation."
    );
  }
}

// Function to get AI API Key from SSM based on provider
async function getAiApiKey(aiProvider) {
  if (aiProvider === "openai" && openAiApiKey) {
    return openAiApiKey;
  }
  if (aiProvider === "xai" && xAiApiKey) {
    return xAiApiKey;
  }

  let ssmParamName;
  if (aiProvider === "openai") {
    ssmParamName = OPENAI_API_KEY_SSM_NAME;
  } else if (aiProvider === "xai") {
    ssmParamName = XAI_API_KEY_SSM_NAME;
  } else {
    throw new Error(`Unsupported AI provider: ${aiProvider}`);
  }

  try {
    console.log(
      `Fetching ${aiProvider} API key from SSM. Name: ${ssmParamName}`
    );
    const command = new GetParametersCommand({
      Names: [ssmParamName],
      WithDecryption: true,
    });
    const { Parameters, InvalidParameters } = await ssmClient.send(command);

    if (InvalidParameters && InvalidParameters.length > 0) {
      console.error(
        `Could not find SSM parameter ${ssmParamName} (InvalidParameters): ${InvalidParameters.join(
          ", "
        )}`
      );
      throw new Error(`Could not find SSM parameter: ${ssmParamName}`);
    }
    if (!Parameters || Parameters.length === 0 || !Parameters[0].Value) {
      console.error(`SSM GetParameters returned no value for ${ssmParamName}.`);
      throw new Error(
        `SSM GetParameters returned no value for ${ssmParamName}.`
      );
    }

    const apiKey = Parameters[0].Value;
    if (aiProvider === "openai") {
      openAiApiKey = apiKey;
    } else if (aiProvider === "xai") {
      xAiApiKey = apiKey;
    }
    console.log(`Successfully fetched and cached ${aiProvider} API key.`);
    return apiKey;
  } catch (error) {
    console.error(`Error fetching ${aiProvider} API key from SSM:`, error);
    throw new Error(`Failed to retrieve ${aiProvider} API key.`);
  }
}

async function getTwitterUserDetails(userAccessToken) {
  console.log(
    `Attempting to use User Access Token (first 10 chars): ${
      userAccessToken ? userAccessToken.substring(0, 10) : "undefined_or_null"
    }(...)`
  );

  try {
    const userClient = new TwitterApi(userAccessToken);
    console.log("TwitterApi client initialized with user access token.");

    const { data: verifiedUser } = await userClient.v2.me({
      "user.fields": ["id", "username", "name", "profile_image_url"],
    });
    console.log("Successfully fetched user from Twitter:", verifiedUser);

    if (!verifiedUser || !verifiedUser.id) {
      console.error(
        "Twitter API returned user data but it was invalid or missing ID:",
        verifiedUser
      );
      throw new Error("Invalid user data received from Twitter API.");
    }

    return {
      id_str: verifiedUser.id,
      screen_name: verifiedUser.username,
      name: verifiedUser.name,
      profile_image_url_https: verifiedUser.profile_image_url,
    };
  } catch (error) {
    console.error(
      "Error in getTwitterUserDetails calling Twitter API (v2.me):",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    );
    throw error;
  }
}

async function revokeTwitterToken(tokenToRevoke) {
  try {
    const { clientId, clientSecret } = await getTwitterAppClientCredentials();

    const encodedClientId = encodeURIComponent(clientId);
    const encodedClientSecret = encodeURIComponent(clientSecret);
    const basicAuth = Buffer.from(
      `${encodedClientId}:${encodedClientSecret}`
    ).toString("base64");

    const body = new URLSearchParams();
    body.append("token", tokenToRevoke);
    body.append("client_id", clientId); // Twitter docs say this is required in body too
    body.append("token_type_hint", "access_token"); // Add token_type_hint

    console.log(
      `Attempting to revoke token (first 10 chars): ${tokenToRevoke.substring(
        0,
        10
      )}(...)`
    );

    const response = await fetch("https://api.twitter.com/2/oauth2/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      // Even if response is not ok, Twitter often returns 200 for already revoked/invalid tokens
      // but body will be empty or { "revoked": false } if truly failed.
      // A 200 with empty body usually means success for revoke.
      // https://developer.twitter.com/en/docs/authentication/oauth-2-0/user-access-token#revoke-an-access-token
      const responseBodyText = await response.text(); // Read text first to check if empty
      console.warn(
        `Twitter token revocation call responded with status ${response.status}. Body: '${responseBodyText}'`
      );
      if (response.status === 200 && responseBodyText === "") {
        // Successfully revoked
        console.log(
          "Token revocation successful (200 OK, empty body from Twitter)."
        );
        return { success: true, message: "Token revoked successfully." };
      }
      // Attempt to parse if not empty, might be JSON with { "revoked": false } or an error
      try {
        const errorData = JSON.parse(responseBodyText);
        if (errorData && errorData.revoked === false) {
          console.warn(
            "Twitter indicated token was not revoked (revoked: false)."
          );
          throw new Error("Twitter indicated token was not revoked.");
        }
        throw new Error(
          `Twitter token revocation failed with status ${response.status}. Details: ${responseBodyText}`
        );
      } catch (parseError) {
        // If body wasn't JSON
        throw new Error(
          `Twitter token revocation failed with status ${response.status}. Non-JSON response: ${responseBodyText}`
        );
      }
    }
    // If response.ok (usually 200 for revoke) and not handled above as an error case
    console.log("Token revocation successful (HTTP 200 OK from Twitter).");
    return { success: true, message: "Token revoked successfully." };
  } catch (error) {
    console.error("Error during token revocation:", error);
    // Don't re-throw the original error to the client, give a generic message
    throw new Error(`Failed to revoke token on backend: ${error.message}`);
  }
}

async function exchangeRefreshToken(refreshTokenFromExtension) {
  console.log("Attempting to exchange refresh token.");
  if (!refreshTokenFromExtension) {
    throw new Error("Refresh token is required.");
  }

  try {
    const { clientId, clientSecret } = await getTwitterAppClientCredentials();

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const bodyParams = new URLSearchParams();
    bodyParams.append("grant_type", "refresh_token");
    bodyParams.append("refresh_token", refreshTokenFromExtension);
    bodyParams.append("client_id", clientId); // Twitter docs specify client_id in body as well

    const response = await fetch(TWITTER_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: bodyParams.toString(),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Twitter refresh token API error:", responseData);
      throw new Error(
        `Twitter token refresh failed with status ${response.status}: ${
          responseData.error_description ||
          responseData.error ||
          "Unknown error"
        }`
      );
    }

    console.log("Successfully refreshed token with Twitter:", responseData);
    // Expected responseData: { token_type, expires_in, access_token, scope, refresh_token (optional) }
    return responseData;
  } catch (error) {
    console.error("Error in exchangeRefreshToken:", error);
    throw new Error( // Re-throw a new error to avoid exposing too much internal detail potentially
      error.message.startsWith("Twitter token refresh failed")
        ? error.message
        : "Failed to exchange refresh token with Twitter."
    );
  }
}

async function performAiSuggestionRequest(
  tweetText,
  toneForApi,
  aiProvider,
  apiKey
) {
  let apiUrl, model, requestBody, headers;

  const systemMessage = `You are an AI assistant. Generate exactly 5 alternative tweet suggestions. Each suggestion should be concise, engaging, and output on a new line. Do not use any numbering or bullet points.`;
  const userMessage = `Rewrite the following tweet in a ${toneForApi} tone AND IN THE SAME LANGUAGE AS THE ORIGINAL TWEET. Provide 5 variations. Original Tweet: "${tweetText}"`;

  if (aiProvider === "openai") {
    apiUrl = OPENAI_CHAT_COMPLETIONS_URL;
    model = "gpt-4.1-nano";
    requestBody = {
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
    };
    headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  } else if (aiProvider === "xai") {
    apiUrl = XAI_CHAT_COMPLETIONS_URL;
    model = "grok-3-mini-beta";
    requestBody = {
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
    };
    headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  } else {
    throw new Error("Invalid AI provider specified.");
  }

  console.log(
    `Sending request to ${aiProvider} API. URL: ${apiUrl}, Model: ${model}`
  );

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(requestBody),
  });

  console.log(`${aiProvider} API status: ${response.status}`);
  const responseBodyText = await response.text();
  console.log(`${aiProvider} API raw response body: ${responseBodyText}`);

  if (!response.ok) {
    console.error(`${aiProvider} API error response: ${responseBodyText}`);
    throw new Error(
      `${aiProvider} API request failed with status ${response.status}: ${responseBodyText}`
    );
  }

  try {
    const responseData = JSON.parse(responseBodyText);

    if (
      responseData.choices &&
      responseData.choices.length > 0 &&
      responseData.choices[0].message &&
      responseData.choices[0].message.content
    ) {
      return responseData.choices[0].message.content;
    } else {
      console.error(
        `Invalid API response format from ${aiProvider}:`,
        responseData
      );
      throw new Error(`Invalid API response format from ${aiProvider}`);
    }
  } catch (e) {
    console.error(
      `Error parsing ${aiProvider} API response or accessing content:`,
      e
    );
    throw new Error(
      `Error parsing ${aiProvider} API response. Raw text was: ${responseBodyText}`
    );
  }
}

exports.handler = async (event) => {
  console.log(`Executing Lambda version: ${LAMBDA_CODE_VERSION}`);
  console.log("Event received:", JSON.stringify(event, null, 2));

  if (
    event.requestContext &&
    event.requestContext.http &&
    event.requestContext.http.method === "OPTIONS"
  ) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin":
          "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Api-Key, X-Action",
        "Access-Control-Max-Age": "86400",
      },
    };
  }

  let requestBody;
  try {
    requestBody =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch (e) {
    console.error("Failed to parse request body:", e);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid request body. Expected JSON." }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin":
          "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
      },
    };
  }

  const action = requestBody.action || "login";
  const {
    accessToken,
    tokenToRevoke,
    refreshToken,
    tweetText,
    toneForApi,
    aiProvider,
  } = requestBody || {};

  try {
    if (action === "logout") {
      if (!tokenToRevoke) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Missing tokenToRevoke for logout action",
          }),
          headers: {
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }
      const revocationResult = await revokeTwitterToken(tokenToRevoke);
      return {
        statusCode: 200,
        body: JSON.stringify(revocationResult),
        headers: {
          "Access-Control-Allow-Origin":
            "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
        },
      };
    } else if (action === "login") {
      if (!accessToken) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Missing accessToken in request body",
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }
      const twitterUser = await getTwitterUserDetails(accessToken);
      const twitterId = twitterUser.id_str;

      if (!twitterId) {
        console.error("Could not retrieve Twitter User ID.", twitterUser);
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: "Failed to get user details from Twitter.",
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }

      const now = new Date().toISOString();
      let userRecord;
      const getItemParams = {
        TableName: USERS_TABLE_NAME,
        Key: { twitter_id: twitterId },
      };

      try {
        const { Item } = await ddbDocClient.send(new GetCommand(getItemParams));
        userRecord = Item;
      } catch (dbError) {
        console.error("DynamoDB GetItem error:", dbError);
        throw dbError;
      }

      const userItem = {
        twitter_id: twitterId,
        twitter_username: twitterUser.screen_name,
        twitter_name: twitterUser.name,
        twitter_profile_image_url: twitterUser.profile_image_url_https,
        last_login: now,
        number_requests: 0,
        is_paid: false,
        budget: MAX_GENERATION_REQUESTS,
      };

      if (userRecord) {
        console.log(`User ${twitterId} exists. Updating...`);
        userItem.number_requests = userRecord.number_requests || 0;
        userItem.is_paid = userRecord.is_paid || false;
        userItem.budget =
          userRecord.budget === undefined
            ? userItem.is_paid
              ? 0
              : MAX_GENERATION_REQUESTS
            : userRecord.budget;
      } else {
        console.log(`User ${twitterId} is new. Creating...`);
        userItem.created_at = now;
        userItem.number_requests = 0;
        userItem.is_paid = false;
        userItem.budget = MAX_GENERATION_REQUESTS;
      }

      const putItemParams = {
        TableName: USERS_TABLE_NAME,
        Item: userItem,
      };
      await ddbDocClient.send(new PutCommand(putItemParams));
      console.log(`User ${twitterId} data stored/updated in DynamoDB.`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "User authenticated and data stored successfully.",
          userData: {
            id_str: twitterUser.id_str,
            screen_name: twitterUser.screen_name,
            name: twitterUser.name,
            profile_image_url_https: twitterUser.profile_image_url_https,
            number_requests: userItem.number_requests,
            is_paid: userItem.is_paid,
            budget: userItem.budget,
          },
        }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin":
            "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
        },
      };
    } else if (action === "refreshToken") {
      if (!refreshToken) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Missing refreshToken for refreshToken action",
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }
      const newTokens = await exchangeRefreshToken(refreshToken);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Token refreshed successfully.",
          ...newTokens, // Spread the new token data (access_token, expires_in, refresh_token (if any), scope)
        }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin":
            "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
        },
      };
    } else if (action === "generateAiSuggestions") {
      if (!accessToken) {
        return {
          statusCode: 401,
          body: JSON.stringify({
            message: "Unauthorized: Missing Twitter access token.",
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }
      if (!tweetText || !toneForApi || !aiProvider) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message:
              "Missing required parameters for AI suggestions (tweetText, toneForApi, aiProvider).",
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }

      // 1. Authenticate user via their Twitter token and get their Twitter ID
      let twitterUserAuthDetails;
      try {
        // We need twitterId to fetch the user record for request count
        twitterUserAuthDetails = await getTwitterUserDetails(accessToken);
        console.log(
          "User authenticated via Twitter token for AI suggestion request."
        );
      } catch (twitterAuthError) {
        console.warn(
          "Twitter token authentication failed for AI suggestion request:",
          twitterAuthError.message
        );
        // Check if it's an ApiResponseError from twitter-api-v2 to get status code
        let statusCode = 401; // Default to Unauthorized
        if (
          twitterAuthError.constructor &&
          twitterAuthError.constructor.name === "ApiResponseError" &&
          twitterAuthError.code
        ) {
          if (twitterAuthError.code === 401 || twitterAuthError.code === 403) {
            // keep 401 for unauthorized, 403 for forbidden
            statusCode = twitterAuthError.code;
          } else {
            // For other Twitter API errors (like 429 Too Many Requests, 500s), treat as a service error for this specific auth check
            statusCode = 502; // Bad Gateway, as Twitter service had an issue validating
          }
        }
        return {
          statusCode: statusCode,
          body: JSON.stringify({
            message: `Twitter authentication failed: ${twitterAuthError.message}`,
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }

      const twitterId = twitterUserAuthDetails.id_str; // Get twitterId

      // 2. Fetch user from DynamoDB to check request count
      let userRecord;
      try {
        const getItemParams = {
          TableName: USERS_TABLE_NAME,
          Key: { twitter_id: twitterId },
        };
        const { Item } = await ddbDocClient.send(new GetCommand(getItemParams));
        userRecord = Item;

        if (!userRecord) {
          // This case should ideally not happen if user is authenticated and was created/updated at login
          // However, as a safeguard:
          console.error(
            `User ${twitterId} not found in DynamoDB despite successful auth. Allowing request but count will be 0.`
          );
          // Initialize a temporary user record for the purpose of this request
          userRecord = { number_requests: 0, twitter_id: twitterId };
        }
      } catch (dbError) {
        console.error(
          "DynamoDB GetItem error for request count check:",
          dbError
        );
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: "Error fetching user data to check request limit.",
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }

      // Determine current usage and limits
      const currentRequests = userRecord.number_requests || 0;
      const isPaidUser = userRecord.is_paid || false;
      // If budget is undefined: paid users get 0, free users get MAX_GENERATION_REQUESTS
      const userBudgetOrMax =
        userRecord.budget === undefined
          ? isPaidUser
            ? 0
            : MAX_GENERATION_REQUESTS
          : userRecord.budget;

      const effectiveLimit = isPaidUser
        ? userBudgetOrMax
        : MAX_GENERATION_REQUESTS;
      const limitType = isPaidUser ? "budget" : "free request";

      if (currentRequests >= effectiveLimit) {
        console.log(
          `User ${twitterId} has reached the ${limitType} limit of ${effectiveLimit}. Current: ${currentRequests}`
        );
        return {
          statusCode: 403, // Forbidden
          body: JSON.stringify({
            message: `You have reached your maximum ${limitType} limit.`,
            limitReached: true,
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
          },
        };
      }

      // 3. Get AI API Key
      const aiApiKey = await getAiApiKey(aiProvider);

      // 4. Perform AI Suggestion Request
      const suggestionsContent = await performAiSuggestionRequest(
        tweetText,
        toneForApi,
        aiProvider,
        aiApiKey
      );

      // 5. Increment user's request count
      try {
        const updateItemParams = {
          TableName: USERS_TABLE_NAME,
          Key: { twitter_id: twitterId },
          UpdateExpression:
            "SET number_requests = if_not_exists(number_requests, :start) + :inc",
          ExpressionAttributeValues: {
            ":inc": 1,
            ":start": 0,
          },
          ReturnValues: "UPDATED_NEW",
        };
        await ddbDocClient.send(new UpdateCommand(updateItemParams));
        console.log(`Incremented request count for user ${twitterId}.`);
      } catch (dbUpdateError) {
        console.error(
          `Failed to increment request count for user ${twitterId}:`,
          dbUpdateError
        );
        // Decide if this error should fail the whole request or just be logged.
        // For now, logging it, and the suggestion is still returned.
        // Consider if a partial failure here is acceptable.
      }

      // The 'suggestionsContent' is expected to be a string with variations.
      // The client-side (background.js or content.js) will parse this into the desired structure.
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Suggestions generated successfully.",
          suggestions: suggestionsContent,
        }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin":
            "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
        },
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Unknown action: ${action}` }),
        headers: {
          "Access-Control-Allow-Origin":
            "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
        },
      };
    }
  } catch (error) {
    console.error("Error in handler:", error);
    let statusCode = 500;
    let message = "Internal server error";

    if (
      error.message &&
      error.message.startsWith("Failed to revoke token on backend:")
    ) {
      message = error.message;
      // statusCode remains 500 as it's a backend failure to complete the action
    } else if (
      error.constructor &&
      error.constructor.name === "ApiResponseError" &&
      error.code
    ) {
      if (error.code === 401) {
        statusCode = 401;
        message =
          "Twitter API: Unauthorized. The token may be invalid or expired.";
      } else if (error.code === 403) {
        statusCode = 403;
        message =
          "Twitter API: Forbidden. The token may not have the necessary permissions.";
      } else if (error.code === 429) {
        statusCode = 429;
        message = "Twitter API: Too many requests. Rate limit exceeded.";
      } else {
        message = error.message || "An error occurred with the Twitter API.";
      }
    } else if (
      error.message === "Invalid user data received from Twitter API."
    ) {
      statusCode = 502;
      message = error.message;
    } else if (
      error.message ===
      "Failed to retrieve Twitter application credentials for revocation."
    ) {
      // This specific error from getTwitterAppClientCredentials
      statusCode = 500; // Internal server error, can't proceed
      message = error.message;
    }

    if (action === "generateAiSuggestions") {
      console.error(`Error in generateAiSuggestions action: ${error.message}`);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message:
            error.message ||
            "Failed to generate AI suggestions due to an internal error.",
        }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin":
            "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
        },
      };
    }

    return {
      statusCode: statusCode,
      body: JSON.stringify({ message }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin":
          "chrome-extension://dbhahgppmankilhelmgaphlebkndghhb",
      },
    };
  }
};
