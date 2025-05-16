const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { SSMClient, GetParametersCommand } = require("@aws-sdk/client-ssm");
const { TwitterApi } = require("twitter-api-v2");

const LAMBDA_CODE_VERSION = "v1.0.3_SSM_FIX_CLIENT_ID_AND_TYPEHINT";

const region = process.env.AWS_REGION || "eu-west-2";
const ddbClient = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const ssmClient = new SSMClient({ region });

const USERS_TABLE_NAME = "Users";
const TWITTER_API_KEY_SSM_NAME = "/my-extension/twitter/api-key";
const TWITTER_API_SECRET_SSM_NAME = "/my-extension/twitter/api-key-secret";

let twitterAppClientCredentials = null;

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
  const { accessToken, tokenToRevoke } = requestBody || {};

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
      };

      if (userRecord) {
        console.log(`User ${twitterId} exists. Updating...`);
        userItem.number_requests = userRecord.number_requests || 0;
      } else {
        console.log(`User ${twitterId} is new. Creating...`);
        userItem.created_at = now;
        userItem.number_requests = 0;
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
          },
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
