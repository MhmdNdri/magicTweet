// Create a namespace for our extension
window.MagicTweetExtension = {
  isInitialized: false,
  TONE_OPTIONS: {
    SARCASM: "Sarcastic",
    PLAYFUL: "Playful/Funny",
    ROMANTIC: "Romantic/Soft",
    MELANCHOLIC: "Melancholic/Poetic",
    HOPEFUL: "Hopeful/Uplifting",
    CYNICAL: "Cynical/Dark Humor",
    DRAMATIC: "Overdramatic/Theatrical",
    MINIMALIST: "Minimalist/Dry",
    INSPIRATIONAL: "Inspirational/Motivational",
  },
};

// Function to find tweet composer
function findTweetComposer() {
  const selectors = [
    '[data-testid="tweetTextarea_0"]',
    '[data-testid="tweetTextarea_0RichTextInputContainer"]',
    '[data-testid="tweetTextarea_1"]',
    '[data-text="true"]',
    '[role="textbox"]',
    ".public-DraftEditor-content",
    ".DraftEditor-root",
    '[contenteditable="true"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      // Additional check to ensure we're in a tweet composer
      const isTweetComposer =
        element.closest('[data-testid="tweetTextarea_0"]') ||
        element.closest('[data-testid="tweetTextarea_1"]') ||
        element.closest('[role="textbox"]');
      if (isTweetComposer) return element;
    }
  }
  return null;
}

// Function to handle extension context invalidation
function handleExtensionError(error) {
  if (error.message.includes("Extension context invalidated")) {
    const errorMessage = document.createElement("div");
    errorMessage.style.position = "fixed";
    errorMessage.style.top = "20px";
    errorMessage.style.right = "20px";
    errorMessage.style.backgroundColor = "#E0245E";
    errorMessage.style.color = "white";
    errorMessage.style.padding = "12px 20px";
    errorMessage.style.borderRadius = "8px";
    errorMessage.style.zIndex = "999999";
    errorMessage.style.fontFamily =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    errorMessage.textContent =
      "Magic Tweet extension needs to be refreshed. Please reload the page.";
    document.body.appendChild(errorMessage);
    setTimeout(() => errorMessage.remove(), 5000);

    // Remove all extension elements
    removeExtensionElements();

    // Reset initialization state
    window.MagicTweetExtension.isInitialized = false;

    // Wait for the page to be fully loaded before reinitializing
    if (document.readyState === "complete") {
      setTimeout(() => {
        try {
          initialize();
        } catch (e) {
          console.error("Failed to reinitialize:", e);
          // Show a more specific error message
          const reinitError = document.createElement("div");
          reinitError.style.position = "fixed";
          reinitError.style.top = "60px";
          reinitError.style.right = "20px";
          reinitError.style.backgroundColor = "#E0245E";
          reinitError.style.color = "white";
          reinitError.style.padding = "12px 20px";
          reinitError.style.borderRadius = "8px";
          reinitError.style.zIndex = "999999";
          reinitError.style.fontFamily =
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
          reinitError.textContent =
            "Please reload the page to restore the extension.";
          document.body.appendChild(reinitError);
          setTimeout(() => reinitError.remove(), 5000);
        }
      }, 2000); // Increased delay to ensure page is stable
    } else {
      // If page is not fully loaded, wait for it
      window.addEventListener("load", () => {
        setTimeout(() => {
          try {
            initialize();
          } catch (e) {
            console.error("Failed to reinitialize:", e);
          }
        }, 2000);
      });
    }
  }
}

// Function to create floating icon
function createFloatingIcon() {
  try {
    const icon = document.createElement("div");
    icon.id = "magic-tweet-icon";
    icon.className = "magic-tweet-icon";

    // Try to get the icon URL, if it fails, use a fallback
    let iconUrl;
    try {
      iconUrl = chrome.runtime.getURL("icons/icon.svg");
    } catch (e) {
      // Fallback to a data URL if chrome.runtime.getURL fails
      iconUrl =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 0 0 0-1.41L12.42 4.4a.996.996 0 0 0-1.41 0L2.4 13.01a.996.996 0 0 0 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0l8.6-8.6 8.6 8.6c.39.39 1.02.39 1.41 0l1.41-1.41c.39-.39.39-1.02 0-1.41l-8.6-8.6z'/%3E%3C/svg%3E";
    }

    icon.innerHTML = `<img src="${iconUrl}" alt="Magic Tweet" style="width: 40px; height: 40px;">`;

    Object.assign(icon.style, {
      backgroundColor: "#1DA1F2",
      color: "#FFFFFF",
      borderRadius: "50%",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(29, 161, 242, 0.3)",
      transition: "all 0.2s ease",
      position: "fixed",
      right: "calc(50% - 250px)",
      top: "11%",
      zIndex: "999999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });

    icon.addEventListener("mouseover", () => {
      icon.style.transform = "translateY(-2px)";
      icon.style.boxShadow = "0 4px 12px rgba(29, 161, 242, 0.4)";
      icon.style.backgroundColor = "#1a91da";
    });

    icon.addEventListener("mouseout", () => {
      icon.style.transform = "translateY(0)";
      icon.style.boxShadow = "0 2px 8px rgba(29, 161, 242, 0.3)";
      icon.style.backgroundColor = "#1DA1F2";
    });

    icon.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const tweetCompose = findTweetComposer();
      if (!tweetCompose) return;

      const text = tweetCompose.textContent || tweetCompose.innerText;
      if (text) {
        const tonePanel = document.getElementById("magic-tweet-tone-panel");
        if (tonePanel) tonePanel.style.display = "block";
      }
    });

    return icon;
  } catch (error) {
    handleExtensionError(error);
    return null;
  }
}

// Function to handle clicks outside panels
function handleOutsideClick(event) {
  const suggestionPanel = document.getElementById("magic-tweet-panel");
  const tonePanel = document.getElementById("magic-tweet-tone-panel");
  const icon = document.getElementById("magic-tweet-icon");

  if (
    suggestionPanel &&
    tonePanel &&
    !suggestionPanel.contains(event.target) &&
    !tonePanel.contains(event.target) &&
    icon &&
    !icon.contains(event.target)
  ) {
    suggestionPanel.style.display = "none";
    tonePanel.style.display = "none";
  }
}

// Function to create suggestion panel
function createSuggestionPanel() {
  const panel = document.createElement("div");
  panel.id = "magic-tweet-panel";
  panel.className = "magic-tweet-panel";

  Object.assign(panel.style, {
    display: "none",
    position: "fixed",
    right: "38%",
    top: "calc(14% + 50px)",
    width: "300px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: "10000",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "magic-tweet-panel-header";
  Object.assign(header.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #e1e8ed",
    fontWeight: "600",
    color: "#14171A",
  });
  header.innerHTML = `
    <span>Magic Tweet Suggestions</span>
    <button class="magic-tweet-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #657786;">×</button>
  `;

  const content = document.createElement("div");
  content.className = "magic-tweet-panel-content";
  Object.assign(content.style, {
    maxHeight: "400px",
    overflowY: "auto",
    padding: "12px",
    color: "#14171A",
  });

  panel.appendChild(header);
  panel.appendChild(content);

  header.querySelector(".magic-tweet-close").addEventListener("click", () => {
    panel.style.display = "none";
  });

  return panel;
}

// Function to create tone selection panel
function createToneSelectionPanel() {
  const panel = document.createElement("div");
  panel.id = "magic-tweet-tone-panel";
  panel.className = "magic-tweet-panel";

  Object.assign(panel.style, {
    display: "none",
    position: "fixed",
    right: "38%",
    top: "calc(14% + 50px)",
    width: "300px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: "10000",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "magic-tweet-panel-header";
  Object.assign(header.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #e1e8ed",
    fontWeight: "600",
    color: "#14171A",
  });
  header.innerHTML = `
    <span>Select a Tone</span>
    <button class="magic-tweet-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #657786;">×</button>
  `;

  const content = document.createElement("div");
  content.className = "magic-tweet-panel-content";
  content.style.padding = "12px";
  content.style.color = "#14171A";

  const toneButtons = Object.entries(window.MagicTweetExtension.TONE_OPTIONS)
    .map(
      ([key, value]) => `
      <button class="magic-tweet-tone-btn" style="
        width: 100%;
        padding: 10px;
        margin-bottom: 8px;
        background: #FFFFFF;
        border: 1px solid #1DA1F2;
        border-radius: 20px;
        color: #1DA1F2;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      " data-tone="${value}">${value}</button>
    `
    )
    .join("");

  content.innerHTML = toneButtons;

  panel.appendChild(header);
  panel.appendChild(content);

  content.querySelectorAll(".magic-tweet-tone-btn").forEach((button) => {
    button.addEventListener("mouseover", () => {
      button.style.backgroundColor = "#1DA1F2";
      button.style.color = "#FFFFFF";
    });
    button.addEventListener("mouseout", () => {
      button.style.backgroundColor = "#FFFFFF";
      button.style.color = "#1DA1F2";
    });
  });

  header.querySelector(".magic-tweet-close").addEventListener("click", () => {
    panel.style.display = "none";
  });

  return panel;
}

// Function to show loading state
function showLoadingState(panel) {
  const content = panel.querySelector(".magic-tweet-panel-content");
  content.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; padding: 20px;">
      <div style="width: 40px; height: 40px; border: 3px solid #1DA1F2; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px;"></div>
      <div style="color: #14171A; font-size: 14px;">Generating suggestions...</div>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
}

// Function to show error message
function showError(panel, error) {
  const content = panel.querySelector(".magic-tweet-panel-content");
  content.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <div style="color: #E0245E; margin-bottom: 12px; font-weight: 500;">Error: ${error}</div>
      <button class="magic-tweet-retry" style="
        background: #1DA1F2;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s;
      ">Try Again</button>
    </div>
  `;

  content.querySelector(".magic-tweet-retry").addEventListener("click", () => {
    const tonePanel = document.getElementById("magic-tweet-tone-panel");
    if (tonePanel) {
      panel.style.display = "none";
      tonePanel.style.display = "block";
    }
  });
}

// Function to remove all extension elements
function removeExtensionElements() {
  const elements = [
    document.getElementById("magic-tweet-icon"),
    document.getElementById("magic-tweet-panel"),
    document.getElementById("magic-tweet-tone-panel"),
  ];

  elements.forEach((element) => {
    if (element) element.remove();
  });

  document.removeEventListener("click", handleOutsideClick);
}

// Function to add icon and panels to tweet composer
function addIconToComposer(tweetCompose) {
  if (!tweetCompose) return;

  // Create icon and panels if they don't exist
  let icon = document.getElementById("magic-tweet-icon");
  let suggestionPanel = document.getElementById("magic-tweet-panel");
  let tonePanel = document.getElementById("magic-tweet-tone-panel");

  if (!icon) {
    icon = createFloatingIcon();
    document.body.appendChild(icon);
  }
  if (!suggestionPanel) {
    suggestionPanel = createSuggestionPanel();
    document.body.appendChild(suggestionPanel);
  }
  if (!tonePanel) {
    tonePanel = createToneSelectionPanel();
    document.body.appendChild(tonePanel);
  }

  // Initially hide the icon
  if (icon) {
    icon.style.display = "none";
  }

  // Add input event listener to show/hide icon based on text content
  const handleInput = () => {
    const text = tweetCompose.textContent || tweetCompose.innerText;
    if (icon) {
      icon.style.display = text.trim() ? "flex" : "none";
    }
  };

  // Add input event listener
  tweetCompose.addEventListener("input", handleInput);

  // Check initial state
  handleInput();

  // Add click event listener to the icon
  if (icon) {
    icon.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const text = tweetCompose.textContent || tweetCompose.innerText;
      if (text) {
        const tonePanel = document.getElementById("magic-tweet-tone-panel");
        if (tonePanel) tonePanel.style.display = "block";
      }
    });
  }

  // Add tone panel event listeners
  if (tonePanel) {
    tonePanel.querySelectorAll(".magic-tweet-tone-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const tone = button.dataset.tone;
        const text = tweetCompose.textContent || tweetCompose.innerText;

        if (!text || !tone) {
          showError(suggestionPanel, "Missing required information");
          return;
        }

        tonePanel.style.display = "none";
        suggestionPanel.style.display = "block";
        showLoadingState(suggestionPanel);

        try {
          const response = await chrome.runtime.sendMessage({
            action: "generateSuggestions",
            text: text,
            tone: tone,
          });

          if (response && response.suggestions) {
            displaySuggestions(
              response.suggestions,
              suggestionPanel.querySelector(".magic-tweet-panel-content")
            );
          } else if (response && response.error) {
            showError(suggestionPanel, response.error);
          }
        } catch (error) {
          handleExtensionError(error);
        }
      });
    });
  }

  // Add document click listener if not already added
  if (!document.magicTweetClickHandlerAdded) {
    document.addEventListener("click", handleOutsideClick);
    document.magicTweetClickHandlerAdded = true;
  }
}

// Display suggestions in the panel
function displaySuggestions(suggestions, container) {
  container.innerHTML = "";

  if (!suggestions || Object.keys(suggestions).length === 0) {
    container.innerHTML =
      '<div class="magic-tweet-error" style="color: #E0245E;">No suggestions available</div>';
    return;
  }

  Object.entries(suggestions).forEach(([tone, variations]) => {
    const variationsArray = Array.isArray(variations) ? variations : [];
    const suggestion = document.createElement("div");
    suggestion.className = "magic-tweet-suggestion";
    Object.assign(suggestion.style, {
      padding: "12px",
      borderBottom: "1px solid #e1e8ed",
      color: "#14171A",
    });

    const variationsHtml = variationsArray
      .map(
        (text, index) => `
        <div class="magic-tweet-variation" style="margin-bottom: 12px;">
          <div class="magic-tweet-text" style="margin-bottom: 8px; line-height: 1.4;">${text}</div>
          <button class="magic-tweet-use" style="background: #1DA1F2; color: white; border: none; padding: 6px 12px; border-radius: 16px; cursor: pointer; font-weight: 500; transition: background 0.2s;" data-variation="${index}">Use</button>
        </div>
      `
      )
      .join("");

    suggestion.innerHTML = `
      <div class="magic-tweet-tone" style="font-weight: 600; color: #1DA1F2; margin-bottom: 8px;">${tone}</div>
      <div class="magic-tweet-variations">${variationsHtml}</div>
    `;

    suggestion.querySelectorAll(".magic-tweet-use").forEach((button) => {
      button.addEventListener("click", () => {
        const variationIndex = parseInt(button.dataset.variation);
        const text = variationsArray[variationIndex];
        const tweetCompose = findTweetComposer();
        if (tweetCompose) {
          tweetCompose.textContent = text;
          tweetCompose.dispatchEvent(new Event("input", { bubbles: true }));
          document.getElementById("magic-tweet-panel").style.display = "none";
        }
      });

      button.addEventListener("mouseover", () => {
        button.style.backgroundColor = "#1a91da";
      });
      button.addEventListener("mouseout", () => {
        button.style.backgroundColor = "#1DA1F2";
      });
    });

    container.appendChild(suggestion);
  });
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize the content script
function initialize() {
  if (window.MagicTweetExtension.isInitialized) return;

  try {
    // Clear any existing observers
    if (window.MagicTweetExtension.observer) {
      window.MagicTweetExtension.observer.disconnect();
    }

    const observer = new MutationObserver(
      debounce((mutations) => {
        const tweetCompose = findTweetComposer();
        const icon = document.getElementById("magic-tweet-icon");

        // If there's no tweet composer but we have an icon, remove all elements
        if (!tweetCompose && icon) {
          removeExtensionElements();
          return;
        }

        // Only add click listener if we're in a tweet composer
        if (tweetCompose && !icon) {
          const isTweetComposer =
            tweetCompose.closest('[data-testid="tweetTextarea_0"]') ||
            tweetCompose.closest('[data-testid="tweetTextarea_1"]') ||
            tweetCompose.closest('[role="textbox"]');

          if (isTweetComposer) {
            try {
              addIconToComposer(tweetCompose);
            } catch (error) {
              handleExtensionError(error);
            }
          }
        }
      }, 500)
    );

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    // Store the observer for cleanup
    window.MagicTweetExtension.observer = observer;
    window.MagicTweetExtension.isInitialized = true;
  } catch (error) {
    handleExtensionError(error);
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === "ping") {
      sendResponse({ status: "ready" });
      return true;
    }

    if (request.action === "getTweetText") {
      const tweetComposer = findTweetComposer();
      if (tweetComposer) {
        const text = tweetComposer.textContent || tweetComposer.innerText;
        sendResponse({ text: text });
      } else {
        sendResponse({ text: null });
      }
    }
    return true;
  } catch (error) {
    handleExtensionError(error);
    sendResponse({ error: error.message });
    return true;
  }
});

// Initialize when the page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Notify that the content script is ready
try {
  chrome.runtime.sendMessage({ type: "contentScriptReady" });
} catch (error) {
  handleExtensionError(error);
}
