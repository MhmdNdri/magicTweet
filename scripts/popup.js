// This file is intentionally left blank as its functionality
// for theme toggling is now handled by scripts/theme.js
document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("loginWithTwitterButton");
  const authSection = loginButton?.closest(".auth-section"); // Get the parent auth section
  const loggedInSection = document.getElementById("loggedInSection");
  const logoutButton = document.getElementById("logoutTwitterButton");
  const loggedInMessageElement = document.getElementById("loggedInMessage");

  function updateUI(isLoggedIn, userInfo) {
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
    } else {
      authSection?.style.setProperty("display", "flex");
      loggedInSection?.style.setProperty("display", "none", "important");
    }
  }

  // Check login status when popup opens
  chrome.runtime.sendMessage(
    { type: "CHECK_TWITTER_LOGIN_STATUS" },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[popup.js] Error checking login status:",
          chrome.runtime.lastError.message
        );
        updateUI(false);
        return;
      }
      console.log("[popup.js] CHECK_TWITTER_LOGIN_STATUS response:", response); // Debugging line
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
  );

  if (loginButton) {
    loginButton.addEventListener("click", () => {
      // Disable button immediately to prevent multiple clicks
      loginButton.disabled = true;
      loginButton.textContent = "Logging in..."; // Provide immediate feedback

      chrome.runtime.sendMessage({ type: "TWITTER_LOGIN" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[popup.js] Error sending login message:",
            chrome.runtime.lastError.message
          );
          updateUI(false);
          loginButton.disabled = false; // Re-enable on error
          loginButton.textContent =
            chrome.i18n.getMessage("loginWithTwitter") || "Login with Twitter";
        } else if (response && response.error) {
          console.error("[popup.js] Login failed:", response.error);
          updateUI(false);
          loginButton.disabled = false; // Re-enable on error
          loginButton.textContent =
            chrome.i18n.getMessage("loginWithTwitter") || "Login with Twitter";
        } else if (response && response.success && response.userInfo) {
          console.log(
            "[popup.js] Login successful, received userInfo:",
            response.userInfo
          ); // Debugging line
          updateUI(true, response.userInfo);
        } else if (response && response.success) {
          console.log(
            "[popup.js] Login successful, but no userInfo returned to popup."
          ); // Debugging line
          updateUI(true); // This will likely cause the placeholder issue
        } else {
          console.error(
            "[popup.js] Login response was not successful or was unexpected:",
            response
          );
          updateUI(false);
        }
      });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "TWITTER_LOGOUT" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending logout message:",
            chrome.runtime.lastError.message
          );
        } else if (response && response.error) {
          console.error("Logout failed:", response.error);
        } else if (response && response.success) {
          console.log("Logout successful (from popup)");
          updateUI(false);
          loginButton.disabled = false; // Re-enable login button
          loginButton.textContent =
            chrome.i18n.getMessage("loginWithTwitter") || "Login with Twitter";
        }
      });
    });
  }
});
