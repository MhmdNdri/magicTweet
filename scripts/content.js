// Create a namespace for our extension
window.MagicTweetExtension = {
  isInitialized: false,
  currentLang: "en", // Default language
  currentMessages: {},
  // TONE_OPTIONS will be populated after messages load
  TONE_OPTIONS: {},
};

// These keys will be sent to the API. Their corresponding English messages will be used in the prompt.
const API_TONE_MESSAGE_KEYS = {
  SARCASM: "styleSarcastic",
  PLAYFUL: "tonePlayfulFunny",
  ROMANTIC: "toneRomanticSoft",
  MELANCHOLIC: "toneMelancholicPoetic",
  HOPEFUL: "toneHopefulUplifting",
  CYNICAL: "toneCynicalDarkHumor",
  DRAMATIC: "toneOverdramaticTheatrical",
  MINIMALIST: "toneMinimalistDry",
  INSPIRATIONAL: "toneInspirationalMotivational",
};

const AI_PROVIDER_KEY = "magic-tweet-ai-provider"; // Added for consistency

// Function to fetch messages for a specific language (now requests from background)
async function loadMessages(lang) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "getMessages", lang: lang },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            `ContentScript: Error requesting messages for ${lang}:`,
            chrome.runtime.lastError.message
          );
          return reject(chrome.runtime.lastError);
        }
        if (response && response.error) {
          console.error(
            `ContentScript: Received error from background for ${lang}:`,
            response.error
          );
          // Try to resolve with English if initial request for another lang failed at background but background sent english back
          if (response.langUsed === "en" && response.messages) {
            console.warn(
              `ContentScript: Failed to get ${lang}, background provided English fallback.`
            );
            window.MagicTweetExtension.currentLang = "en"; // Explicitly set to 'en' as it's a fallback
            return resolve(response.messages);
          }
          return reject(new Error(response.error));
        }
        if (response && response.messages) {
          if (response.langUsed && response.langUsed !== lang) {
            console.warn(
              `ContentScript: Requested ${lang} but received ${response.langUsed} from background.`
            );
            window.MagicTweetExtension.currentLang = response.langUsed; // Update lang if background used a fallback
          }
          return resolve(response.messages);
        }
        // If no messages and no error, something unexpected happened.
        console.error(
          `ContentScript: No messages or error in response for ${lang}. Response:`,
          response
        );
        return reject(
          new Error(`Unexpected response from background for ${lang}`)
        );
      }
    );
  });
}

// Function to get a localized string
function getLocalizedString(key, fallback = "") {
  const msgData = window.MagicTweetExtension.currentMessages[key];
  return msgData ? msgData.message : fallback || key; // Return key if no fallback
}

// Function to apply translations to dynamically created elements
function applyContentScriptTranslations() {
  // Update panel headers
  const suggestionPanelHeader = document.querySelector(
    "#magic-tweet-panel .magic-tweet-header span"
  );
  if (suggestionPanelHeader) {
    suggestionPanelHeader.textContent = getLocalizedString(
      "suggestionPanelHeader"
    );
  }
  const tonePanelHeader = document.querySelector(
    "#magic-tweet-tone-panel .magic-tweet-header span"
  );
  if (tonePanelHeader) {
    tonePanelHeader.textContent = getLocalizedString(
      "toneSelectionPanelHeader"
    );
  }

  // Update tone buttons (regenerate them with new text)
  const tonePanelContent = document.querySelector(
    "#magic-tweet-tone-panel .magic-tweet-suggestions"
  );
  if (tonePanelContent) {
    // Iterate over the API_TONE_MESSAGE_KEYS to ensure consistent button order and data
    let toneButtonsHtml = "";
    for (const internalKey in API_TONE_MESSAGE_KEYS) {
      const messageKey = API_TONE_MESSAGE_KEYS[internalKey];
      const localizedText = getLocalizedString(messageKey); // Get current localized text
      toneButtonsHtml += `
        <button class="magic-tweet-tone-btn" 
          style="width: 100%; padding: 10px; margin-bottom: 8px; background: #FFFFFF; border: 1px solid #1DA1F2; border-radius: 20px; color: #1DA1F2; font-weight: 500; cursor: pointer; transition: all 0.2s;"
          data-tone-api-key="${messageKey}">${localizedText}</button>
      `;
    }
    tonePanelContent.innerHTML = toneButtonsHtml;
    addToneButtonListeners(document.getElementById("magic-tweet-tone-panel"));
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    applyThemeToTonePanel(
      document.getElementById("magic-tweet-tone-panel"),
      isDark
    );
  }

  const iconImg = document.querySelector("#magic-tweet-icon img");
  if (iconImg) {
    iconImg.alt = getLocalizedString("extensionName");
  }

  // Note: Existing suggestions/errors in panels will be updated if showError/showLoading/displaySuggestions
  // are called again after a language change (e.g., by clicking Try Again or generating new suggestions).
  // We don't explicitly re-translate existing suggestions here, as that would require re-fetching.
}

// Function to add tone button listeners (extracted for reuse)
function addToneButtonListeners(tonePanel) {
  if (!tonePanel) return;
  const suggestionPanel = document.getElementById("magic-tweet-panel");
  tonePanel.querySelectorAll(".magic-tweet-tone-btn").forEach((button) => {
    button.replaceWith(button.cloneNode(true));
    const newButton = tonePanel.querySelector(
      `[data-tone-api-key="${button.dataset.toneApiKey}"]`
    );
    if (!newButton) return;

    newButton.addEventListener("mouseover", () => {
      newButton.style.backgroundColor = "#1DA1F2";
      newButton.style.color = "#FFFFFF";
    });
    newButton.addEventListener("mouseout", () => {
      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";
      newButton.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
      newButton.style.color = "#1DA1F2";
    });

    newButton.addEventListener("click", async () => {
      const toneApiKey = newButton.dataset.toneApiKey; // THIS IS THE ENGLISH MESSAGE KEY
      const tweetCompose = findTweetComposer();
      const text = tweetCompose
        ? tweetCompose.textContent || tweetCompose.innerText
        : null;

      if (!text || !toneApiKey) {
        showError(suggestionPanel, getLocalizedString("errorMissingInfo"));
        return;
      }

      // Hide tone panel and show suggestion panel
      tonePanel.style.display = "none";
      if (suggestionPanel) {
        suggestionPanel.style.display = "block";
        suggestionPanel.style.position = "fixed";
        suggestionPanel.style.right = "38%";
        suggestionPanel.style.top = "calc(14% + 50px)";
        suggestionPanel.style.zIndex = "10000";
        showLoadingState(suggestionPanel);
      }

      // Get AI provider preference from storage
      chrome.storage.local.get([AI_PROVIDER_KEY], async (result) => {
        const aiProvider = result[AI_PROVIDER_KEY] || "openai"; // Default to openai

        try {
          const response = await chrome.runtime.sendMessage({
            action: "generateSuggestions",
            text: text,
            tone: toneApiKey, // Send the English message key
            aiProvider: aiProvider, // Add the selected AI provider
          });

          if (!suggestionPanel) return; // Exit if panel removed

          if (response && response.suggestions) {
            const suggestions = response.suggestions;
            if (
              typeof suggestions === "object" &&
              Object.keys(suggestions).length > 0
            ) {
              displaySuggestions(
                suggestions,
                suggestionPanel.querySelector(".magic-tweet-suggestions")
              );
            } else {
              showError(
                suggestionPanel,
                getLocalizedString("errorNoSuggestions")
              );
            }
          } else if (response && response.error) {
            showError(suggestionPanel, response.error);
          } else {
            showError(
              suggestionPanel,
              getLocalizedString("errorFailedSuggestions")
            );
          }
        } catch (error) {
          console.error("Error generating suggestions:", error);
          handleExtensionError(error);
          if (suggestionPanel) {
            showError(
              suggestionPanel,
              getLocalizedString("errorFailedSuggestions")
            );
          }
        }
      });
    });
  });
}

// Helper to apply theme updates to tone panel elements
function applyThemeToTonePanel(panel, isDark) {
  if (!panel) return;
  panel.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
  panel.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
  panel.style.color = isDark ? "#FFFFFF" : "#14171A";

  const buttons = panel.querySelectorAll(".magic-tweet-tone-btn");
  buttons.forEach((button) => {
    button.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
    button.style.borderColor = "#1DA1F2";
    button.style.color = "#1DA1F2";
  });

  const header = panel.querySelector(".magic-tweet-header");
  if (header) {
    header.style.borderBottomColor = isDark ? "#38444D" : "#E1E8ED";
  }
}

// Function to populate TONE_OPTIONS from loaded messages
function populateToneOptions() {
  // TONE_OPTIONS stores the *localized display text* for the buttons
  window.MagicTweetExtension.TONE_OPTIONS = {
    SARCASM: getLocalizedString(API_TONE_MESSAGE_KEYS.SARCASM, "Sarcastic"),
    PLAYFUL: getLocalizedString(API_TONE_MESSAGE_KEYS.PLAYFUL, "Playful/Funny"),
    ROMANTIC: getLocalizedString(
      API_TONE_MESSAGE_KEYS.ROMANTIC,
      "Romantic/Soft"
    ),
    MELANCHOLIC: getLocalizedString(
      API_TONE_MESSAGE_KEYS.MELANCHOLIC,
      "Melancholic/Poetic"
    ),
    HOPEFUL: getLocalizedString(
      API_TONE_MESSAGE_KEYS.HOPEFUL,
      "Hopeful/Uplifting"
    ),
    CYNICAL: getLocalizedString(
      API_TONE_MESSAGE_KEYS.CYNICAL,
      "Cynical/Dark Humor"
    ),
    DRAMATIC: getLocalizedString(
      API_TONE_MESSAGE_KEYS.DRAMATIC,
      "Overdramatic/Theatrical"
    ),
    MINIMALIST: getLocalizedString(
      API_TONE_MESSAGE_KEYS.MINIMALIST,
      "Minimalist/Dry"
    ),
    INSPIRATIONAL: getLocalizedString(
      API_TONE_MESSAGE_KEYS.INSPIRATIONAL,
      "Inspirational/Motivational"
    ),
  };
}

// Function to set the UI language
async function setContentScriptLanguage(lang) {
  const messages = await loadMessages(lang);
  if (messages) {
    window.MagicTweetExtension.currentLang = lang;
    window.MagicTweetExtension.currentMessages = messages;
    populateToneOptions(); // Repopulate TONE_OPTIONS with new language
    applyContentScriptTranslations(); // Apply translations to existing UI elements
    // The panels and icons might need to be re-created or explicitly updated if they are already on the page
    const icon = document.getElementById("magic-tweet-icon");
    if (icon && icon.style.display !== "none") {
      // If icon is visible, re-run parts of its setup that might depend on language
      // This is a bit of a heavy-handed approach, might need refinement
      const tweetCompose = findTweetComposer();
      if (tweetCompose) addIconToComposer(tweetCompose); // Re-adds icon, which will use new localized alt text
    }
  } else {
    console.warn(`ContentScript: Could not set language to ${lang}.`);
  }
}

// Listen for theme changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.userLanguage) {
    const newLang = changes.userLanguage.newValue;
    if (newLang && newLang !== window.MagicTweetExtension.currentLang) {
      console.log(`ContentScript: Language changed to ${newLang}`);
      setContentScriptLanguage(newLang);
    }
  }
  // Handle theme changes as before
  if (namespace === "local" && changes["magic-tweet-theme"]) {
    const newTheme = changes["magic-tweet-theme"].newValue;
    document.documentElement.setAttribute("data-theme", newTheme);
    // Update dynamic panels theme if they exist
    const suggestionPanel = document.getElementById("magic-tweet-panel");
    const tonePanel = document.getElementById("magic-tweet-tone-panel");
    if (suggestionPanel) {
      // Assuming createSuggestionPanel has an internal updateTheme or similar
      // For now, we call the theme update function of createSuggestionPanel if it exists and can be exposed,
      // or we replicate its theme logic here.
      // This part needs careful integration with how panels handle their own theme updates.
    }
    if (tonePanel) {
      applyThemeToTonePanel(tonePanel, newTheme === "dark");
    }
  }
});

// Initialize theme
function initTheme() {
  chrome.storage.local.get(["magic-tweet-theme"], (result) => {
    const theme = result["magic-tweet-theme"] || "light";
    document.documentElement.setAttribute("data-theme", theme);
  });
}

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
    errorMessage.textContent = getLocalizedString("errorRefreshExtension");
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
          reinitError.textContent = getLocalizedString("errorReloadToRestore");
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

    icon.innerHTML = `<img src="${iconUrl}" alt="${getLocalizedString(
      "extensionName"
    )}" style="width: 40px; height: 40px;">`;

    Object.assign(icon.style, {
      backgroundColor: "transparent",
      color: "#FFFFFF",
      borderRadius: "50%",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(29, 161, 242, 0.3)",
      transition: "all 0.2s ease",
      position: "fixed",
      right: "calc(50% - 250px)",
      top: "12%",
      zIndex: "999999",
      width: "32px",
      height: "32px",
      display: "none", // Initially hidden
      alignItems: "center",
      justifyContent: "center",
    });

    icon.addEventListener("mouseover", () => {
      icon.style.transform = "translateY(-2px)";
      icon.style.boxShadow = "0 4px 12px rgba(29, 161, 242, 0.4)";
    });

    icon.addEventListener("mouseout", () => {
      icon.style.transform = "translateY(0)";
      icon.style.boxShadow = "0 2px 8px rgba(29, 161, 242, 0.3)";
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
  panel.className = "magic-tweet-container";

  // Set initial styles
  Object.assign(panel.style, {
    display: "none",
    position: "fixed",
    right: "38%",
    top: "calc(14% + 50px)",
    width: "300px",
    zIndex: "10000",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    border: "1px solid #E1E8ED",
    padding: "12px",
    color: "#14171A",
  });

  // Add theme support
  const updateTheme = (isDark) => {
    panel.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
    panel.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
    panel.style.color = isDark ? "#FFFFFF" : "#14171A";

    // Update all suggestion elements
    const suggestions = panel.querySelectorAll(".magic-tweet-suggestion");
    suggestions.forEach((suggestion) => {
      suggestion.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
      suggestion.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
      suggestion.style.color = isDark ? "#FFFFFF" : "#14171A";
    });

    // Update all variation elements
    const variations = panel.querySelectorAll(".magic-tweet-variation");
    variations.forEach((variation) => {
      variation.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
      variation.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
    });

    // Update all text elements
    const texts = panel.querySelectorAll(
      ".magic-tweet-text, .magic-tweet-tone"
    );
    texts.forEach((text) => {
      text.style.color = isDark ? "#FFFFFF" : "#14171A";
    });
  };

  // Check current theme
  chrome.storage.local.get(["magic-tweet-theme"], (result) => {
    updateTheme(result["magic-tweet-theme"] === "dark");
  });

  // Listen for theme changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes["magic-tweet-theme"]) {
      updateTheme(changes["magic-tweet-theme"].newValue === "dark");
    }
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "magic-tweet-header";
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #E1E8ED;
  `;
  header.innerHTML = `
    <span style="font-weight: 500;">${getLocalizedString(
      "suggestionPanelHeader"
    )}</span>
    <button class="magic-tweet-close" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
  `;

  const content = document.createElement("div");
  content.className = "magic-tweet-suggestions";
  content.style.cssText = `
    max-height: 400px;
    overflow-y: auto;
    padding-right: 4px;
  `;

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
  panel.className = "magic-tweet-container";

  // Set initial styles
  Object.assign(panel.style, {
    display: "none",
    position: "fixed",
    right: "38%",
    top: "calc(14% + 50px)",
    width: "300px",
    zIndex: "10000",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    border: "1px solid #E1E8ED",
    padding: "12px",
    color: "#14171A",
  });

  // Add theme support
  const updateTheme = (isDark) => {
    panel.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
    panel.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
    panel.style.color = isDark ? "#FFFFFF" : "#14171A";

    // Update tone buttons
    const buttons = panel.querySelectorAll(".magic-tweet-tone-btn");
    buttons.forEach((button) => {
      button.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
      button.style.borderColor = "#1DA1F2";
      button.style.color = "#1DA1F2";
    });
  };

  // Check current theme
  chrome.storage.local.get(["magic-tweet-theme"], (result) => {
    updateTheme(result["magic-tweet-theme"] === "dark");
  });

  // Listen for theme changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes["magic-tweet-theme"]) {
      updateTheme(changes["magic-tweet-theme"].newValue === "dark");
    }
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "magic-tweet-header";
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #E1E8ED;
  `;
  header.innerHTML = `
    <span style="font-weight: 500;">${getLocalizedString(
      "toneSelectionPanelHeader"
    )}</span>
    <button class="magic-tweet-close" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
  `;

  const content = document.createElement("div");
  content.className = "magic-tweet-suggestions";
  content.style.cssText = `
    max-height: 400px;
    overflow-y: auto;
    padding-right: 4px;
  `;

  // Iterate over API_TONE_MESSAGE_KEYS for consistency
  let toneButtonsHtml = "";
  for (const internalKey in API_TONE_MESSAGE_KEYS) {
    const messageKey = API_TONE_MESSAGE_KEYS[internalKey];
    const localizedText = getLocalizedString(messageKey); // Get current localized text
    toneButtonsHtml += `
      <button class="magic-tweet-tone-btn" 
        style="width: 100%; padding: 10px; margin-bottom: 8px; background: #FFFFFF; border: 1px solid #1DA1F2; border-radius: 20px; color: #1DA1F2; font-weight: 500; cursor: pointer; transition: all 0.2s;"
        data-tone-api-key="${messageKey}">${localizedText}</button>
    `;
  }
  content.innerHTML = toneButtonsHtml;

  panel.appendChild(header);
  panel.appendChild(content);

  // Centralize listener attachment
  addToneButtonListeners(panel);

  header.querySelector(".magic-tweet-close").addEventListener("click", () => {
    panel.style.display = "none";
  });

  return panel;
}

// Function to show loading state
function showLoadingState(panel) {
  const content = panel.querySelector(".magic-tweet-suggestions");
  content.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; min-height: 100px;">
      <div class="loading-dots-container" style="display: flex; align-items: center; margin-bottom: 15px;">
        <div class="loading-dot" style="animation-delay: 0s;"></div>
        <div class="loading-dot" style="animation-delay: 0.2s;"></div>
        <div class="loading-dot" style="animation-delay: 0.4s;"></div>
      </div>
      <div style="color: var(--text-color); font-size: 14px;">${getLocalizedString(
        "loadingSuggestions"
      )}</div>
    </div>
    <style>
      .loading-dots-container .loading-dot {
        width: 8px; /* Smaller dots */
        height: 8px; /* Smaller dots */
        background-color: var(--primary-color, #1DA1F2);
        border-radius: 50%;
        margin: 0 4px;
        animation: bounce 1s infinite ease-in-out both; /* Faster animation */
      }

      @keyframes bounce {
        0%, 80%, 100% {
          transform: scale(0);
        }
        40% {
          transform: scale(1.0);
        }
      }
    </style>
  `;
}

// Function to show error message
function showError(panel, error) {
  const content = panel.querySelector(".magic-tweet-suggestions");
  content.innerHTML = `
    <div style="padding: 8px; text-align: center;">
      <div style="color: var(--error-color); margin-bottom: 12px; font-weight: 500;">${getLocalizedString(
        "errorPrefix"
      )}${error}</div>
      <button class="magic-tweet-retry" style="
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s;
      ">${getLocalizedString("tryAgainButton")}</button>
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

  // Add input event listener to show/hide icon based on text content
  const handleInput = () => {
    const text = tweetCompose.textContent || tweetCompose.innerText || "";
    const isEmpty =
      !text.trim() || text === "" || text === "\n" || text === "\r\n";

    if (icon) {
      icon.style.display = isEmpty ? "none" : "flex";
    }

    // Also hide panels if text is empty
    if (isEmpty) {
      if (suggestionPanel) suggestionPanel.style.display = "none";
      if (tonePanel) tonePanel.style.display = "none";
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

      const text = tweetCompose.textContent || tweetCompose.innerText || "";
      if (text.trim()) {
        // Hide suggestion panel if it's visible
        if (suggestionPanel) {
          suggestionPanel.style.display = "none";
        }

        // Show tone panel
        if (tonePanel) {
          tonePanel.style.display = "block";
          // Position the panel
          tonePanel.style.position = "fixed";
          tonePanel.style.right = "38%";
          tonePanel.style.top = "calc(14% + 50px)";
          tonePanel.style.zIndex = "10000";
        }
      }
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
  // Define SVG Icons as constants (with white stroke for contrast)
  const COPY_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;
  const SUCCESS_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-square">
      <polyline points="9 11 12 14 22 4"></polyline>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  `;
  const ERROR_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x-square">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="9" y1="9" x2="15" y2="15"></line>
      <line x1="15" y1="9" x2="9" y2="15"></line>
    </svg>
  `;

  container.innerHTML = ""; // Clear previous suggestions

  if (!suggestions) {
    container.innerHTML = `<div class="magic-tweet-error" style="color: #E0245E;">${getLocalizedString(
      "errorNoSuggestionsAvailable"
    )}</div>`;
    return;
  }

  try {
    // Handle different response formats
    let suggestionsToDisplay = [];

    if (typeof suggestions === "string") {
      // If it's a single string, wrap it in an object
      suggestionsToDisplay = [
        {
          tone: getLocalizedString("defaultSuggestionTone"),
          variations: [suggestions],
        },
      ];
    } else if (Array.isArray(suggestions)) {
      // If it's an array, convert each item to the proper format
      suggestionsToDisplay = suggestions.map((suggestion) => {
        if (typeof suggestion === "string") {
          return {
            tone: getLocalizedString("defaultSuggestionTone"),
            variations: [suggestion],
          };
        }
        return suggestion;
      });
    } else if (typeof suggestions === "object") {
      // If it's an object with variations
      if (suggestions.variations) {
        suggestionsToDisplay = [suggestions];
      } else {
        // If it's an object with multiple tones
        suggestionsToDisplay = Object.entries(suggestions).map(
          ([tone, variations]) => ({
            tone: tone,
            variations: Array.isArray(variations) ? variations : [variations],
          })
        );
      }
    }

    if (
      !Array.isArray(suggestionsToDisplay) ||
      suggestionsToDisplay.length === 0
    ) {
      container.innerHTML = `<div class="magic-tweet-error" style="color: #E0245E;">${getLocalizedString(
        "errorNoSuggestionsAvailable"
      )}</div>`;
      return;
    }

    // Now we can safely use forEach since we know suggestionsToDisplay is an array
    suggestionsToDisplay.forEach((suggestion) => {
      if (!suggestion || !suggestion.variations) return;

      const suggestionDiv = document.createElement("div");
      suggestionDiv.className = "magic-tweet-suggestion";
      suggestionDiv.style.cssText = `
        margin-bottom: 16px;
        padding: 12px;
        background: #FFFFFF;
        border: 1px solid #E1E8ED;
        border-radius: 8px;
        color: #14171A;
      `;

      const tone =
        suggestion.tone || getLocalizedString("defaultSuggestionTone");
      const variations = Array.isArray(suggestion.variations)
        ? suggestion.variations
        : [suggestion.variations];

      const variationsHtml = variations
        .filter((text) => text) // Filter out null/undefined/empty strings
        .map((text, index) => {
          const isRTL = document.documentElement.dir === "rtl";
          // Define styles for the floated button
          const buttonFloatStyle = `
              float: ${isRTL ? "left" : "right"};
              margin-${
                isRTL ? "right" : "left"
              }: 4px; /* Space between text and icon */
              margin-top: 2px; /* Adjust vertical position slightly */
            `;

          return `
          <div class="magic-tweet-variation" style="
            /* position: relative; removed */
            overflow: hidden; /* Contain the floated button */
            margin-bottom: 8px;
            padding: 8px; /* Overall padding */
            background: #FFFFFF;
            border: 1px solid #E1E8ED;
            border-radius: 6px;
            color: #14171A;
          ">
            <div class="magic-tweet-text" style="
              color: #14171A;
              /* Side padding removed */
            ">${text}</div>
            <button class="magic-tweet-copy" style="
              ${buttonFloatStyle}
              /* position: absolute; removed */
              /* bottom/left/right removed */
              background: #1DA1F2;
              color: white;
              border: none;
              padding: 4px 8px; /* Button's own padding */
              border-radius: 16px;
              cursor: pointer;
              transition: background 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
            " data-variation="${index}">
              ${COPY_ICON_SVG} 
            </button>
            <!-- Optional: Add a clearfix element if overflow:hidden causes issues, but try without first -->
            <!-- <div style="clear: both;"></div> -->
          </div>
        `;
        })
        .join("");

      if (!variationsHtml) return;

      suggestionDiv.innerHTML = `
        <div class="magic-tweet-tone" style="
          font-weight: 500;
          margin-bottom: 8px;
          color: #14171A;
        ">${tone}</div>
        <div class="magic-tweet-variations">${variationsHtml}</div>
      `;

      suggestionDiv.querySelectorAll(".magic-tweet-copy").forEach((button) => {
        button.addEventListener("click", async () => {
          const variationIndex = parseInt(button.dataset.variation);
          const text = variations[variationIndex];

          if (!text) return;

          try {
            await navigator.clipboard.writeText(text);
            // Change background color and icon on success
            button.innerHTML = SUCCESS_ICON_SVG;
            button.style.backgroundColor = "#17BF63"; // Original success color
            // button.style.opacity = "1"; // Remove opacity changes

            setTimeout(() => {
              // Restore original icon and background
              button.innerHTML = COPY_ICON_SVG;
              button.style.backgroundColor = "#1DA1F2"; // Original blue color
              // button.style.opacity = "0.7"; // Remove opacity changes
            }, 2000);

            document.getElementById("magic-tweet-panel").style.display = "none";
          } catch (err) {
            console.error("Failed to copy text:", err);
            // Change background color and icon on failure
            button.innerHTML = ERROR_ICON_SVG;
            button.style.backgroundColor = "#E0245E"; // Original error color
            // button.style.opacity = "1"; // Remove opacity changes

            setTimeout(() => {
              // Restore original icon and background
              button.innerHTML = COPY_ICON_SVG;
              button.style.backgroundColor = "#1DA1F2"; // Original blue color
              // button.style.opacity = "0.7"; // Remove opacity changes
            }, 2000);
          }
        });

        // Restore original hover effect (background color change)
        button.addEventListener("mouseover", () => {
          // Only change hover color if it's the default state
          if (button.style.backgroundColor === "rgb(29, 161, 242)") {
            // Check for #1DA1F2
            button.style.backgroundColor = "#1a91da"; // Original hover color
          }
          // button.style.opacity = '1'; // Remove opacity changes
        });
        button.addEventListener("mouseout", () => {
          // Restore background color based on current state (copy/success/error)
          const currentIconHTML = button.innerHTML.trim();
          if (currentIconHTML === COPY_ICON_SVG.trim()) {
            button.style.backgroundColor = "#1DA1F2"; // Original blue
          } else if (currentIconHTML === SUCCESS_ICON_SVG.trim()) {
            // Keep success color on mouseout if success icon is showing
            button.style.backgroundColor = "#17BF63";
          } else if (currentIconHTML === ERROR_ICON_SVG.trim()) {
            // Keep error color on mouseout if error icon is showing
            button.style.backgroundColor = "#E0245E";
          }
          // button.style.opacity = '0.7'; // Remove opacity changes
        });
      });

      container.appendChild(suggestionDiv);
    });

    // Update theme for newly added suggestions
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const updateTheme = (isDark) => {
      const suggestions = container.querySelectorAll(".magic-tweet-suggestion");
      suggestions.forEach((suggestion) => {
        suggestion.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
        suggestion.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
        suggestion.style.color = isDark ? "#FFFFFF" : "#14171A";
      });

      const variations = container.querySelectorAll(".magic-tweet-variation");
      variations.forEach((variation) => {
        variation.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
        variation.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
      });

      const texts = container.querySelectorAll(
        ".magic-tweet-text, .magic-tweet-tone"
      );
      texts.forEach((text) => {
        text.style.color = isDark ? "#FFFFFF" : "#14171A";
      });
    };

    updateTheme(isDark);
  } catch (error) {
    console.error("Error displaying suggestions:", error);
    container.innerHTML = `<div class="magic-tweet-error" style="color: #E0245E;">${getLocalizedString(
      "errorDisplayingSuggestions"
    )}</div>`;
  }
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
async function initialize() {
  if (window.MagicTweetExtension.isInitialized) return;

  // Get initial language from storage
  try {
    const result = await chrome.storage.local.get("userLanguage");
    const initialLang = result.userLanguage || "en"; // Default to English
    await setContentScriptLanguage(initialLang); // Await language setup
  } catch (e) {
    console.error(
      "ContentScript: Error getting initial language from storage",
      e
    );
    await setContentScriptLanguage("en"); // Fallback to English
  }

  // Initialize theme (after language potentially sets TONE_OPTIONS that theme might use)
  initTheme();

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
              initTheme(); // Initialize theme
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

    // Initial check
    const tweetCompose = findTweetComposer();
    if (tweetCompose) {
      addIconToComposer(tweetCompose);
      initTheme();
    }
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
