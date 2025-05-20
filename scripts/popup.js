// This file is intentionally left blank as its functionality
// for theme toggling is now handled by scripts/theme.js
document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("loginWithTwitterButton");
  const authSection = loginButton?.closest(".auth-section"); // Get the parent auth section
  const loggedInSection = document.getElementById("loggedInSection");
  const logoutButton = document.getElementById("logoutTwitterButton");
  const loggedInMessageElement = document.getElementById("loggedInMessage");
  const suggestionsCountMessageElement = document.getElementById(
    "suggestionsCountMessage"
  ); // New element
  const suggestionsRemainingCountElement = document.getElementById(
    "suggestionsRemainingCount"
  ); // New element
  const errorMessageArea = document.getElementById("errorMessageArea"); // Get the error message display element
  const toastNotification = document.getElementById("toastNotification"); // Get toast element

  let toastTimeout = null; // To manage the toast hide timeout
  const POPUP_LOAD_TIME = Date.now(); // Timestamp for when popup loaded

  const MAX_FREE_REQUESTS = 150; // Define this constant

  // Function to show toast notifications
  function showToast(message, type = "error") {
    // default type is 'error'
    if (!toastNotification) return;

    toastNotification.textContent = message;
    toastNotification.className = "toast show"; // Base classes
    if (type === "success") {
      toastNotification.classList.add("success");
    } else {
      toastNotification.classList.add("error"); // Default to error styling
    }

    // Clear any existing timeout to prevent premature hiding if called multiple times
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
      toastNotification.classList.remove("show");
      // Reset classes after hiding animation completes
      setTimeout(() => {
        toastNotification.className = "toast";
      }, 500); // Match transition duration
    }, 3000); // Show toast for 3 seconds
  }

  // Store original button texts for restoring them after an action
  const originalLoginButtonText = loginButton
    ? chrome.i18n.getMessage("loginWithTwitter") || "Login with Twitter"
    : "";
  const originalLogoutButtonText = logoutButton
    ? chrome.i18n.getMessage("logoutTwitter") || "Logout"
    : "";
  // For a production extension, add a "loggingOut" message to your locales
  const loggingOutButtonText =
    chrome.i18n.getMessage("loggingOut") || "Logging out...";
  const checkingStatusButtonText =
    chrome.i18n.getMessage("checkingStatus") || "Checking status..."; // New loading text

  function updateUI(isLoggedIn, userInfo) {
    if (errorMessageArea) errorMessageArea.textContent = ""; // Clear previous errors

    console.log(
      "[popup.js] updateUI called. isLoggedIn:",
      isLoggedIn,
      "Raw userInfo:",
      userInfo
    ); // Debugging line
    if (isLoggedIn && userInfo && userInfo.username) {
      authSection?.style.setProperty("display", "none", "important");
      loggedInSection?.style.setProperty("display", "flex");
      const username = userInfo.username;
      console.log("[popup.js] Username to display:", username); // Debugging line
      const message = chrome.i18n.getMessage("loggedInAsUser", [username]);
      console.log("[popup.js] Generated message from i18n:", message); // Debugging line
      if (loggedInMessageElement) {
        loggedInMessageElement.textContent = message;
        loggedInMessageElement.removeAttribute("data-i18n");
      }
      // Update suggestions count
      if (
        suggestionsCountMessageElement &&
        suggestionsRemainingCountElement &&
        userInfo.number_requests !== undefined
      ) {
        const isPaid = userInfo.is_paid || false;
        const currentRequests = Number(userInfo.number_requests) || 0;

        let userBudgetAsNumber;
        if (userInfo.budget !== undefined) {
          userBudgetAsNumber = Number(userInfo.budget);
          // If budget from userInfo is not a valid number, default appropriately
          if (isNaN(userBudgetAsNumber)) {
            console.warn(
              `[popup.js] userInfo.budget ('${userInfo.budget}') is not a valid number.`
            );
            userBudgetAsNumber = isPaid ? 0 : MAX_FREE_REQUESTS;
          }
        } else {
          // If budget is undefined in userInfo, default appropriately
          userBudgetAsNumber = isPaid ? 0 : MAX_FREE_REQUESTS;
        }

        const effectiveLimit = isPaid ? userBudgetAsNumber : MAX_FREE_REQUESTS;
        const remaining = Math.max(0, effectiveLimit - currentRequests);

        // Detailed logging for diagnostics
        console.log("[popup.js] Suggestions Count Calculation:", {
          rawUserInfo: JSON.parse(JSON.stringify(userInfo)), // Deep copy for safety
          calculatedIsPaid: isPaid,
          calculatedCurrentRequests: currentRequests,
          parsedUserBudget: userBudgetAsNumber,
          calculatedEffectiveLimit: effectiveLimit,
          calculatedRemaining: remaining,
          MAX_FREE_REQUESTS_CONST: MAX_FREE_REQUESTS,
        });

        suggestionsRemainingCountElement.textContent = remaining;
        suggestionsCountMessageElement.style.display = "block"; // Make sure it's block, not inline
      } else if (suggestionsCountMessageElement) {
        suggestionsCountMessageElement.style.display = "none";
        console.log(
          "[popup.js] Hiding suggestions count message because user info or elements are incomplete."
        );
      }
    } else if (isLoggedIn) {
      // Logged in but no user info (fallback)
      console.log(
        "[popup.js] Logged in, but no userInfo.username. Using fallback message."
      ); // Debugging line
      authSection?.style.setProperty("display", "none", "important");
      loggedInSection?.style.setProperty("display", "flex");
      if (loggedInMessageElement) {
        loggedInMessageElement.textContent =
          chrome.i18n.getMessage("loggedInMessage") || "Logged In";
        loggedInMessageElement.removeAttribute("data-i18n");
      }
      if (suggestionsCountMessageElement)
        suggestionsCountMessageElement.style.display = "none"; // Hide if not fully logged in with info
    } else {
      authSection?.style.setProperty("display", "flex");
      loggedInSection?.style.setProperty("display", "none", "important");
      if (suggestionsCountMessageElement)
        suggestionsCountMessageElement.style.display = "none"; // Hide on logout
    }
  }

  // Check login status when popup opens
  // Immediately set a loading state for the auth section
  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = checkingStatusButtonText;
  }
  if (logoutButton) {
    logoutButton.disabled = true; // Disable logout too during check
  }

  chrome.runtime.sendMessage(
    { type: "CHECK_TWITTER_LOGIN_STATUS" },
    (response) => {
      // if (errorMessageArea) errorMessageArea.textContent = ""; // Toast handles this
      if (chrome.runtime.lastError) {
        console.error(
          "[popup.js] CHECK_TWITTER_LOGIN_STATUS Error:",
          chrome.runtime.lastError.message
        );
        // Don't show toast for initial status check error here, as it might be confusing.
        // The login button will allow retry.
        // showToast(chrome.runtime.lastError.message || chrome.i18n.getMessage("errorCheckingStatus"));
        updateUI(false);
      } else {
        console.log(
          "[popup.js] CHECK_TWITTER_LOGIN_STATUS response:",
          response
        ); // Debugging line
        if (response && response.isLoggedIn && response.userInfo) {
          console.log(
            "User is already logged in with Twitter.",
            response.userInfo
          );
          updateUI(true, response.userInfo);
        } else {
          updateUI(false);
        }
      }
      // Restore button states after check is complete, updateUI will handle correct visibility and text
      if (loginButton) {
        loginButton.disabled = false;
        // updateUI will set the correct text if user is logged out (originalLoginButtonText)
        // or hide it if logged in.
      }
      if (logoutButton) {
        logoutButton.disabled = false;
        // updateUI will set the correct text if user is logged in (originalLogoutButtonText)
        // or hide it if logged out.
      }

      // After updating UI based on current login status, check for a recent auth action message
      chrome.storage.local.get("lastAuthAction", (data) => {
        if (data.lastAuthAction) {
          const { type, status, message, timestamp } = data.lastAuthAction;
          // Show toast only if the action happened recently (e.g., within last 10 seconds)
          // to avoid showing old messages if popup wasn't opened immediately after action.
          // And also check if the timestamp is after the popup was loaded, to avoid showing stale messages from previous popup sessions.
          if (timestamp > POPUP_LOAD_TIME - 10000) {
            showToast(message, status);
          }
          // Clear the flag so it doesn't show again on next popup open
          chrome.storage.local.remove("lastAuthAction");
        }
      });
    }
  );

  if (loginButton) {
    loginButton.addEventListener("click", () => {
      // Disable button immediately to prevent multiple clicks
      loginButton.disabled = true;
      loginButton.textContent =
        chrome.i18n.getMessage("loggingIn") || "Logging in...";
      if (errorMessageArea) errorMessageArea.textContent = ""; // Clear previous errors on new attempt

      chrome.runtime.sendMessage({ type: "TWITTER_LOGIN" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[popup.js] TWITTER_LOGIN Error:",
            chrome.runtime.lastError.message
          );
          loginButton.disabled = false;
          loginButton.textContent = originalLoginButtonText;
          showToast(
            chrome.runtime.lastError.message ||
              chrome.i18n.getMessage("loginFailed")
          );
          return;
        }
        if (response && response.error) {
          console.error("[popup.js] TWITTER_LOGIN Failed:", response.error);
          loginButton.disabled = false; // Re-enable button on failure
          loginButton.textContent = originalLoginButtonText; // Reset button text
          showToast(response.error); // Display the error in a toast
          updateUI(false);
        } else if (response && response.success && response.userInfo) {
          console.log(
            "[popup.js] TWITTER_LOGIN successful. UserInfo:",
            response.userInfo
          );
          // showToast(chrome.i18n.getMessage("loginSuccessMessage") || "Login successful!", "success"); // Background script now sets this for next load
          updateUI(true, response.userInfo); // Update UI with logged-in state
        } else {
          console.error("[popup.js] TWITTER_LOGIN Invalid response:", response);
          // loginButton.disabled = false; // Already handled by error cases
          // loginButton.textContent = originalLoginButtonText;
          // showToast(chrome.i18n.getMessage("loginFailed")); // Background script now sets this for next load
        }
      });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      logoutButton.disabled = true;
      logoutButton.textContent = loggingOutButtonText;
      if (errorMessageArea) errorMessageArea.textContent = ""; // Clear previous errors

      chrome.runtime.sendMessage({ type: "TWITTER_LOGOUT" }, (response) => {
        logoutButton.disabled = false; // Re-enable button
        logoutButton.textContent = originalLogoutButtonText; // Reset button text

        if (chrome.runtime.lastError) {
          console.error(
            "[popup.js] Error sending logout message:",
            chrome.runtime.lastError.message
          );
          // if (errorMessageArea) errorMessageArea.textContent = response.error;
          // showToast(response.error); // Background script now sets this for next load
          return; // Exit early
        }

        if (response && response.success) {
          console.log("[popup.js] Logout successful.");
          // showToast(chrome.i18n.getMessage("logoutSuccessMessage") || "Logout successful!", "success"); // Background script now sets this for next load
          updateUI(false);
          if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = originalLoginButtonText;
          }
        } else if (response && response.error) {
          console.error(
            "[popup.js] Logout failed from backend:",
            response.error
          );
          // if (errorMessageArea) errorMessageArea.textContent = response.error;
          // showToast(response.error); // Background script now sets this for next load
        } else {
          console.error(
            "[popup.js] Logout failed due to an unknown reason or unexpected response."
          );
          // if (errorMessageArea) errorMessageArea.textContent = chrome.i18n.getMessage("logoutFailed");
          // showToast(chrome.i18n.getMessage("logoutFailed")); // Background script now sets this for next load
        }
      });
    });
  }
});
