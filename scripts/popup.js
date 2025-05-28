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

    // Get new profile card elements
    const userProfileImage = document.getElementById("userProfileImage");
    const userAvatarFallback = document.getElementById("userAvatarFallback");
    const userDisplayName = document.getElementById("userDisplayName");
    const userUsername = document.getElementById("userUsername");
    const suggestionsCountBadge = document.getElementById(
      "suggestionsCountBadge"
    );
    const suggestionsRemainingCount = document.getElementById(
      "suggestionsRemainingCount"
    );

    if (isLoggedIn && userInfo && userInfo.username) {
      authSection?.style.setProperty("display", "none", "important");
      loggedInSection?.style.setProperty("display", "flex");

      // Handle profile image
      if (
        userInfo.profile_image_url &&
        userProfileImage &&
        userAvatarFallback
      ) {
        userProfileImage.src = userInfo.profile_image_url;
        userProfileImage.style.display = "block";
        userAvatarFallback.style.display = "none";

        // Handle image load error
        userProfileImage.onerror = function () {
          console.log(
            "[popup.js] Failed to load profile image, showing fallback"
          );
          userProfileImage.style.display = "none";
          userAvatarFallback.style.display = "flex";
        };
      } else if (userAvatarFallback) {
        // No profile image URL, show fallback
        if (userProfileImage) userProfileImage.style.display = "none";
        userAvatarFallback.style.display = "flex";
      }

      // Update user display name
      if (userDisplayName) {
        userDisplayName.textContent =
          userInfo.name || userInfo.username || "User";
      }

      // Update username
      if (userUsername) {
        userUsername.textContent = userInfo.username || "";
      }

      // Update suggestions count badge
      if (
        suggestionsCountBadge &&
        suggestionsRemainingCount &&
        userInfo.number_requests !== undefined
      ) {
        const isPaid = userInfo.is_paid || false;
        const currentRequests = Number(userInfo.number_requests) || 0;

        let userBudgetAsNumber;
        if (userInfo.budget !== undefined) {
          userBudgetAsNumber = Number(userInfo.budget);
          if (isNaN(userBudgetAsNumber)) {
            console.warn(
              `[popup.js] userInfo.budget ('${userInfo.budget}') is not a valid number.`
            );
            userBudgetAsNumber = isPaid ? 0 : MAX_FREE_REQUESTS;
          }
        } else {
          userBudgetAsNumber = isPaid ? 0 : MAX_FREE_REQUESTS;
        }

        const effectiveLimit = isPaid ? userBudgetAsNumber : MAX_FREE_REQUESTS;
        const remaining = Math.max(0, effectiveLimit - currentRequests);

        suggestionsRemainingCount.textContent = remaining;
        suggestionsCountBadge.style.display = "flex";
      } else if (suggestionsCountBadge) {
        suggestionsCountBadge.style.display = "none";
        console.log(
          "[popup.js] Hiding suggestions count badge because user info is incomplete."
        );
      }

      // Legacy elements handling for backward compatibility
      if (loggedInMessageElement) {
        const username = userInfo.username;
        const message = chrome.i18n.getMessage("loggedInAsUser", [username]);
        loggedInMessageElement.textContent = message;
        loggedInMessageElement.removeAttribute("data-i18n");
      }
      if (suggestionsCountMessageElement) {
        suggestionsCountMessageElement.style.display = "none";
      }
    } else if (isLoggedIn) {
      // Logged in but no user info (fallback)
      console.log(
        "[popup.js] Logged in, but no userInfo.username. Using fallback message."
      );
      authSection?.style.setProperty("display", "none", "important");
      loggedInSection?.style.setProperty("display", "flex");

      // Show fallback avatar
      if (userProfileImage) userProfileImage.style.display = "none";
      if (userAvatarFallback) userAvatarFallback.style.display = "flex";

      // Show fallback user info
      if (userDisplayName) userDisplayName.textContent = "User";
      if (userUsername) userUsername.textContent = "";
      if (suggestionsCountBadge) suggestionsCountBadge.style.display = "none";

      // Legacy elements
      if (loggedInMessageElement) {
        loggedInMessageElement.textContent =
          chrome.i18n.getMessage("loggedInMessage") || "Logged In";
        loggedInMessageElement.removeAttribute("data-i18n");
      }
      if (suggestionsCountMessageElement)
        suggestionsCountMessageElement.style.display = "none";
    } else {
      // Not logged in
      authSection?.style.setProperty("display", "flex");
      loggedInSection?.style.setProperty("display", "none", "important");

      // Hide all profile elements
      if (userProfileImage) userProfileImage.style.display = "none";
      if (userAvatarFallback) userAvatarFallback.style.display = "none";
      if (suggestionsCountBadge) suggestionsCountBadge.style.display = "none";
      if (suggestionsCountMessageElement)
        suggestionsCountMessageElement.style.display = "none";
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
        if (response && response.isLoggedIn && response.userInfo) {
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
