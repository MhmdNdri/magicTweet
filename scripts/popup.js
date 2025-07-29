document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("loginWithTwitterButton");
  const authSection = loginButton?.closest(".auth-section"); // Get the parent auth section
  const loggedInSection = document.getElementById("loggedInSection");
  const loadingSection = document.getElementById("loadingSection");
  const loadingMessage = document.getElementById("loadingMessage");
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

  // No longer need original button texts since we're using state management

  // Function to show different UI states
  function showUIState(state, message = null) {
    // Hide all sections first
    if (authSection) authSection.style.display = "none";
    if (loggedInSection) loggedInSection.style.display = "none";
    if (loadingSection) loadingSection.style.display = "none";

    switch (state) {
      case "loading":
        if (loadingSection) {
          loadingSection.style.display = "flex";
          if (loadingMessage && message) {
            loadingMessage.textContent = message;
          }
        }
        break;
      case "login":
        if (authSection) authSection.style.display = "flex";
        break;
      case "loggedIn":
        if (loggedInSection) loggedInSection.style.display = "flex";
        break;
    }
  }

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
    const videoDownloadsBadge = document.getElementById(
      "videoDownloadsBadge"
    );
    const videoDownloadsRemainingCount = document.getElementById(
      "videoDownloadsRemainingCount"
    );

    if (isLoggedIn && userInfo && userInfo.username) {
      showUIState("loggedIn");

      // Debug: Log user info to check video budget fields
      console.log("[popup.js] User info received:", {
        video_downloads_budget: userInfo.video_downloads_budget,
        video_downloaded: userInfo.video_downloaded,
        budget: userInfo.budget,
        number_requests: userInfo.number_requests
      });

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

      // Update video downloads badge
      console.log("[popup.js] Checking video downloads badge conditions:", {
        videoDownloadsBadge: !!videoDownloadsBadge,
        videoDownloadsRemainingCount: !!videoDownloadsRemainingCount,
        video_downloads_budget: userInfo.video_downloads_budget,
        video_downloaded: userInfo.video_downloaded,
        budget_undefined: userInfo.video_downloads_budget === undefined,
        downloaded_undefined: userInfo.video_downloaded === undefined
      });
      
      if (
        videoDownloadsBadge &&
        videoDownloadsRemainingCount &&
        userInfo.video_downloads_budget !== undefined &&
        userInfo.video_downloaded !== undefined
      ) {
        const videoBudget = Number(userInfo.video_downloads_budget) || 0;
        const videoDownloaded = Number(userInfo.video_downloaded) || 0;
        const videoRemaining = Math.max(0, videoBudget - videoDownloaded);

        console.log("[popup.js] Showing video downloads badge:", {
          videoBudget,
          videoDownloaded,
          videoRemaining
        });

        videoDownloadsRemainingCount.textContent = videoRemaining;
        videoDownloadsBadge.style.display = "flex";
      } else if (videoDownloadsBadge) {
        videoDownloadsBadge.style.display = "none";
        console.log(
          "[popup.js] Hiding video downloads badge because video budget info is incomplete."
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
      showUIState("loggedIn");

      // Show fallback avatar
      if (userProfileImage) userProfileImage.style.display = "none";
      if (userAvatarFallback) userAvatarFallback.style.display = "flex";

      // Show fallback user info
      if (userDisplayName) userDisplayName.textContent = "User";
      if (userUsername) userUsername.textContent = "";
      if (suggestionsCountBadge) suggestionsCountBadge.style.display = "none";
      if (videoDownloadsBadge) videoDownloadsBadge.style.display = "none";

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
      showUIState("login");

      // Hide all profile elements
      if (userProfileImage) userProfileImage.style.display = "none";
      if (userAvatarFallback) userAvatarFallback.style.display = "none";
      if (suggestionsCountBadge) suggestionsCountBadge.style.display = "none";
      if (videoDownloadsBadge) videoDownloadsBadge.style.display = "none";
      if (suggestionsCountMessageElement)
        suggestionsCountMessageElement.style.display = "none";
    }
  }

  // Check login status when popup opens
  // Show loading state immediately
  showUIState(
    "loading",
    chrome.i18n.getMessage("checkingStatus") || "Checking login status..."
  );

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
      // Add loading state to login button and show loading section
      loginButton.disabled = true;
      loginButton.classList.add("button-loading");
      showUIState(
        "loading",
        chrome.i18n.getMessage("authenticating") || "Authenticating..."
      );
      if (errorMessageArea) errorMessageArea.textContent = ""; // Clear previous errors on new attempt

      chrome.runtime.sendMessage({ type: "TWITTER_LOGIN" }, (response) => {
        // Remove loading state from login button
        loginButton.disabled = false;
        loginButton.classList.remove("button-loading");

        if (chrome.runtime.lastError) {
          console.error(
            "[popup.js] TWITTER_LOGIN Error:",
            chrome.runtime.lastError.message
          );
          showToast(
            chrome.runtime.lastError.message ||
              chrome.i18n.getMessage("loginFailed")
          );
          updateUI(false); // Show login form again
          return;
        }
        if (response && response.error) {
          console.error("[popup.js] TWITTER_LOGIN Failed:", response.error);
          showToast(response.error); // Display the error in a toast
          updateUI(false); // Show login form again
        } else if (response && response.success && response.userInfo) {
          console.log(
            "[popup.js] TWITTER_LOGIN successful. UserInfo:",
            response.userInfo
          );
          // Show loading state while loading user info
          showUIState(
            "loading",
            chrome.i18n.getMessage("loadingUserInfo") ||
              "Loading user information..."
          );
          // Small delay to show the loading message, then update UI
          setTimeout(() => {
            updateUI(true, response.userInfo); // Update UI with logged-in state
          }, 500);
        } else {
          console.error("[popup.js] TWITTER_LOGIN Invalid response:", response);
          updateUI(false); // Show login form again
        }
      });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      if (errorMessageArea) errorMessageArea.textContent = ""; // Clear previous errors

      // Add loading state to logout button
      logoutButton.disabled = true;
      logoutButton.classList.add("button-loading");

      chrome.runtime.sendMessage({ type: "TWITTER_LOGOUT" }, (response) => {
        // Remove loading state
        logoutButton.disabled = false;
        logoutButton.classList.remove("button-loading");
        if (chrome.runtime.lastError) {
          console.error(
            "[popup.js] Error sending logout message:",
            chrome.runtime.lastError.message
          );
          return; // Exit early
        }

        if (response && response.success) {
          console.log("[popup.js] Logout successful.");
          updateUI(false);
        } else if (response && response.error) {
          console.error(
            "[popup.js] Logout failed from backend:",
            response.error
          );
        } else {
          console.error(
            "[popup.js] Logout failed due to an unknown reason or unexpected response."
          );
        }
      });
    });
  }
});
