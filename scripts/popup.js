document.addEventListener("DOMContentLoaded", async () => {
  const statusIndicator = document.getElementById("statusIndicator");
  const suggestionsList = document.getElementById("suggestions");
  const refreshBtn = document.getElementById("refreshBtn");
  const copyBtn = document.getElementById("copyBtn");
  const toneButtons = document.querySelectorAll(".tone-btn");

  let currentTone = "professional";
  let selectedSuggestion = null;
  let tweetText = "";
  let retryCount = 0;
  const MAX_RETRIES = 3;
  let contentScriptReady = false;

  // Check if we're on Twitter
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isTwitter =
    tab.url.includes("twitter.com") || tab.url.includes("x.com");

  if (!isTwitter) {
    showError("Please open Twitter to use Magic Tweet");
    return;
  }

  // Wait for content script to be ready
  const waitForContentScript = () => {
    return new Promise((resolve) => {
      const checkContentScript = async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "ping" });
          resolve(true);
        } catch (error) {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(checkContentScript, 1000);
          } else {
            resolve(false);
          }
        }
      };
      checkContentScript();
    });
  };

  // Inject content script if not already injected
  if (tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  }

  // Wait for content script to be ready
  contentScriptReady = await waitForContentScript();
  if (!contentScriptReady) {
    showError("Could not connect to Twitter. Please refresh the page.");
    return;
  }

  // Set up tone button listeners
  toneButtons.forEach((button) => {
    button.addEventListener("click", () => {
      toneButtons.forEach((btn) => {
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      currentTone = button.dataset.tone;
      if (tweetText) {
        generateSuggestions(tweetText);
      }
    });
  });

  // Set up action button listeners
  refreshBtn.addEventListener("click", () => {
    if (tweetText) {
      generateSuggestions(tweetText);
    }
  });

  copyBtn.addEventListener("click", () => {
    if (selectedSuggestion) {
      navigator.clipboard
        .writeText(selectedSuggestion)
        .then(() => {
          showToast("Copied to clipboard!");
        })
        .catch(() => {
          showError("Failed to copy to clipboard");
        });
    }
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "tweetText") {
      tweetText = message.text;
      if (tweetText) {
        statusIndicator.classList.add("active");
        generateSuggestions(tweetText);
      } else {
        statusIndicator.classList.remove("active");
        showEmptyState();
      }
    }
    return true;
  });

  // Request initial tweet text
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "getTweetText",
    });
    if (response && response.text) {
      tweetText = response.text;
      statusIndicator.classList.add("active");
      generateSuggestions(tweetText);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error("Error getting tweet text:", error);
    showError("Could not connect to Twitter. Please refresh the page.");
  }

  async function generateSuggestions(text) {
    if (!text) {
      showEmptyState();
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "generateSuggestions",
        text,
        tone: currentTone,
      });

      if (!response) {
        showError("No response from server. Please try again.");
        return;
      }

      if (response.error) {
        showError(response.error);
        return;
      }

      if (
        !response.suggestions ||
        Object.keys(response.suggestions).length === 0
      ) {
        showError("No suggestions generated. Please try again.");
        return;
      }

      displaySuggestions(response.suggestions);
    } catch (error) {
      console.error("Error generating suggestions:", error);
      showError("Failed to generate suggestions. Please try again.");
    }
  }

  function displaySuggestions(suggestions) {
    suggestionsList.innerHTML = "";
    selectedSuggestion = null;
    copyBtn.disabled = true;

    if (!suggestions || suggestions.length === 0) {
      showEmptyState();
      return;
    }

    suggestions.forEach((suggestion, index) => {
      const div = document.createElement("div");
      div.className = "suggestion";
      div.textContent = suggestion;
      div.addEventListener("click", () => {
        document
          .querySelectorAll(".suggestion")
          .forEach((s) => s.classList.remove("selected"));
        div.classList.add("selected");
        selectedSuggestion = suggestion;
        copyBtn.disabled = false;
      });
      suggestionsList.appendChild(div);
    });

    refreshBtn.disabled = false;
  }

  function showEmptyState() {
    suggestionsList.innerHTML = `
      <div class="empty-state">
        <p>Start composing a tweet to get suggestions</p>
      </div>
    `;
    refreshBtn.disabled = true;
    copyBtn.disabled = true;
  }

  function showError(message) {
    suggestionsList.innerHTML = `
      <div class="empty-state">
        <p>${message}</p>
      </div>
    `;
    refreshBtn.disabled = true;
    copyBtn.disabled = true;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
});
