// Create a namespace for our extension
window.MagicTweetExtension = {
  isInitialized: false,
  currentLang: "en", // Default language
  currentMessages: {},
  // TONE_OPTIONS will be populated after messages load
  TONE_OPTIONS: {},
  currentThemeIsDark: false, // Added for centralized theme state
  observer: null,
  pollingInterval: null,
  lastInitAttempt: 0,
};

// Constants for IDs and Class Names
const EXT_NAMESPACE = "magic-tweet";
const ICON_ID = `${EXT_NAMESPACE}-icon`;
const SUGGESTION_PANEL_ID = `${EXT_NAMESPACE}-panel`;
const TONE_PANEL_ID = `${EXT_NAMESPACE}-tone-panel`;
const CONTAINER_CLASS = `${EXT_NAMESPACE}-container`;
const HEADER_CLASS = `${EXT_NAMESPACE}-header`;
const SUGGESTIONS_CLASS = `${EXT_NAMESPACE}-suggestions`; // Content area for both panels
const CLOSE_BUTTON_CLASS = `${EXT_NAMESPACE}-close`;
const TONE_BUTTON_CLASS = `${EXT_NAMESPACE}-tone-btn`;
const SUGGESTION_CLASS = `${EXT_NAMESPACE}-suggestion`;
const VARIATION_CLASS = `${EXT_NAMESPACE}-variation`;
const TEXT_CLASS = `${EXT_NAMESPACE}-text`;
const TONE_TEXT_CLASS = `${EXT_NAMESPACE}-tone`; // For the tone title in suggestions
const COPY_BUTTON_CLASS = `${EXT_NAMESPACE}-copy`;
const RETRY_BUTTON_CLASS = `${EXT_NAMESPACE}-retry`;
const ERROR_CLASS = `${EXT_NAMESPACE}-error`;
const TOAST_ID = `${EXT_NAMESPACE}-content-toast`; // Added for content script toasts

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
    `#${SUGGESTION_PANEL_ID} .${HEADER_CLASS} span`
  );
  if (suggestionPanelHeader) {
    suggestionPanelHeader.textContent = getLocalizedString(
      "suggestionPanelHeader"
    );
  }
  const tonePanelHeader = document.querySelector(
    `#${TONE_PANEL_ID} .${HEADER_CLASS} span`
  );
  if (tonePanelHeader) {
    tonePanelHeader.textContent = getLocalizedString(
      "toneSelectionPanelHeader"
    );
  }

  // Update tone buttons (regenerate them with new text)
  const tonePanelContent = document.querySelector(
    `#${TONE_PANEL_ID} .${SUGGESTIONS_CLASS}`
  );
  if (tonePanelContent) {
    // Iterate over the API_TONE_MESSAGE_KEYS to ensure consistent button order and data
    let toneButtonsHtml = "";
    for (const internalKey in API_TONE_MESSAGE_KEYS) {
      const messageKey = API_TONE_MESSAGE_KEYS[internalKey];
      const localizedText = getLocalizedString(messageKey); // Get current localized text
      toneButtonsHtml += `
        <button class="${TONE_BUTTON_CLASS}" 
          style="width: 100%; padding: 10px; margin-bottom: 8px; background: #FFFFFF; border: 1px solid #1DA1F2; border-radius: 20px; color: #1DA1F2; font-weight: 500; cursor: pointer; transition: all 0.2s;"
          data-tone-api-key="${messageKey}">${localizedText}</button>
      `;
    }
    tonePanelContent.innerHTML = toneButtonsHtml;
    const tonePanelElement = document.getElementById(TONE_PANEL_ID);
    addToneButtonListeners(tonePanelElement);
    if (tonePanelElement) {
      themeTonePanelDOM(
        tonePanelElement,
        window.MagicTweetExtension.currentThemeIsDark
      );
    }
  }

  const iconImg = document.querySelector(`#${ICON_ID} img`);
  if (iconImg) {
    iconImg.alt = getLocalizedString("extensionName");
  }

  // Note: Existing suggestions/errors in panels will be updated if showError/showLoading/displaySuggestions
  // are called again after a language change (e.g., by clicking Try Again or generating new suggestions).
  // We don't explicitly re-translate existing suggestions here, as that would require re-fetching.
}

// Function to add tone button listeners (This will be moved to event_handlers.js later)
function addToneButtonListeners(tonePanel) {
  if (!tonePanel) return;
  const suggestionPanel = document.getElementById(SUGGESTION_PANEL_ID);
  tonePanel.querySelectorAll(`.${TONE_BUTTON_CLASS}`).forEach((button) => {
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
      const isDark = window.MagicTweetExtension.currentThemeIsDark; // Use global state
      newButton.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
      newButton.style.color = "#1DA1F2";
    });

    newButton.addEventListener("click", async () => {
      const toneApiKey = newButton.dataset.toneApiKey;
      const tweetCompose = findTweetComposer();
      const text = tweetCompose
        ? tweetCompose.textContent || tweetCompose.innerText
        : null;

      // Get fresh references to panels inside the click handler
      const currentSuggestionPanel =
        document.getElementById(SUGGESTION_PANEL_ID);
      const currentTonePanel = document.getElementById(TONE_PANEL_ID);

      if (!text || !toneApiKey) {
        if (currentSuggestionPanel)
          showError(
            currentSuggestionPanel,
            getLocalizedString("errorMissingInfo")
          );
        return;
      }

      if (currentTonePanel) currentTonePanel.style.display = "none";
      if (currentSuggestionPanel) {
        currentSuggestionPanel.style.display = "block";
        currentSuggestionPanel.style.position = "fixed";
        currentSuggestionPanel.style.right = "38%";
        currentSuggestionPanel.style.top = "calc(14% + 50px)";
        currentSuggestionPanel.style.zIndex = "10000";
        showLoadingState(currentSuggestionPanel);
      }

      chrome.storage.local.get([AI_PROVIDER_KEY], async (result) => {
        const aiProvider = result[AI_PROVIDER_KEY] || "openai";
        try {
          const response = await chrome.runtime.sendMessage({
            action: "generateSuggestions",
            text: text,
            tone: toneApiKey,
            aiProvider: aiProvider,
          });

          // Get a fresh reference to suggestionPanel again, as it might have been affected by async operations or DOM changes
          const freshSuggestionPanel =
            document.getElementById(SUGGESTION_PANEL_ID);
          if (!freshSuggestionPanel) return;

          if (response && response.suggestions) {
            const suggestions = response.suggestions;
            if (
              typeof suggestions === "object" &&
              Object.keys(suggestions).length > 0
            ) {
              displaySuggestions(
                suggestions,
                freshSuggestionPanel.querySelector(`.${SUGGESTIONS_CLASS}`)
              );
            } else {
              showError(
                freshSuggestionPanel,
                getLocalizedString("errorNoSuggestions")
              );
            }
          } else if (response && response.error) {
            if (response.needsLogin) {
              // Handle the case where user needs to log in
              // For now, show error. A better UX might be to prompt login via popup.
              showError(
                freshSuggestionPanel,
                response.error +
                  " " +
                  (getLocalizedString("guidanceOpenPopupToLogin") ||
                    "Please open the extension popup to log in.")
              );
            } else {
              showError(freshSuggestionPanel, response.error);
            }
          } else {
            showError(
              freshSuggestionPanel,
              getLocalizedString("errorFailedSuggestions")
            );
          }
        } catch (error) {
          console.error("Error generating suggestions:", error);
          handleExtensionError(error);
          // Get a fresh reference in case of error too
          const freshSuggestionPanelOnError =
            document.getElementById(SUGGESTION_PANEL_ID);
          if (freshSuggestionPanelOnError) {
            showError(
              freshSuggestionPanelOnError,
              getLocalizedString("errorFailedSuggestions")
            );
          }
        }
      });
    });
  });
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
    const icon = document.getElementById(ICON_ID);
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

// Listen for theme changes (and language changes)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.userLanguage) {
    const newLang = changes.userLanguage.newValue;
    if (newLang && newLang !== window.MagicTweetExtension.currentLang) {
      console.log(`ContentScript: Language changed to ${newLang}`);
      setContentScriptLanguage(newLang);
    }
  }
  // Handle theme changes centrally
  if (namespace === "local" && changes["magic-tweet-theme"]) {
    const newTheme = changes["magic-tweet-theme"].newValue;
    applyGlobalThemeStyles(newTheme === "dark"); // Call the centralized function
  }
});

// Initialize theme
async function initTheme() {
  try {
    // Wrap chrome.storage.local.get in a Promise for async/await
    const result = await new Promise((resolve) =>
      chrome.storage.local.get(["magic-tweet-theme"], resolve)
    );
    const theme = result["magic-tweet-theme"] || "light"; // Default to 'light'
    applyGlobalThemeStyles(theme === "dark");
  } catch (e) {
    console.error("ContentScript: Error initializing theme from storage:", e);
    applyGlobalThemeStyles(false); // Fallback to light theme on error
  }
}

// Function to find tweet composer
function findTweetComposer() {
  const selectors = [
    // Most specific: Direct tweet text areas
    { selector: '[data-testid="tweetTextarea_0"]', isInput: true },
    { selector: '[data-testid="tweetTextarea_1"]', isInput: true }, // For replies/threads

    // Specific containers - look for the actual input inside
    {
      selector: '[data-testid="tweetTextarea_0RichTextInputContainer"]',
      inputSelector: '[role="textbox"], [contenteditable="true"]',
    },

    // General textboxes within Twitter's known UI structure for composing
    // Try to be more specific than just [role="textbox"] globally
    {
      selector:
        'div[data-testid="primaryColumn"] [role="textbox"][contenteditable="true"]',
      isInput: true,
    }, // Main composer in primary column
    {
      selector:
        'div[aria-labelledby="modal-header"] [role="textbox"][contenteditable="true"]',
      isInput: true,
    }, // Composer in a modal

    // More generic, but still somewhat scoped
    { selector: '[data-text="true"]', isInput: true },
    { selector: ".public-DraftEditor-content", isInput: true }, // Older editor structure
    {
      selector: ".DraftEditor-root",
      inputSelector: '.public-DraftEditor-content, [contenteditable="true"]',
    }, // Older editor structure

    // Broadest contenteditable, only if it's likely part of a composer UI.
    // Check its parent or grandparent for common composer data-testid attributes.
    { selector: '[contenteditable="true"]', checkParent: true, isInput: true },
  ];

  for (const item of selectors) {
    const elements = document.querySelectorAll(item.selector);
    for (const element of elements) {
      if (item.isInput) {
        // If element itself is supposed to be the input
        // Add checks to ensure it's visible and not part of a displayed tweet
        if (
          element.offsetParent !== null &&
          !element.closest('[data-testid="tweetText"]')
        ) {
          // Check if it's within a known composer structure more reliably
          const composerParent = element.closest(
            'div[data-testid^="tweetComposer"]'
          ); // More generic composer parent
          const modalComposer = element.closest(
            'div[aria-labelledby="modal-header"]'
          );
          const mainTweetArea = element.closest(
            '[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea_1"]'
          );

          if (
            composerParent ||
            modalComposer ||
            mainTweetArea ||
            element.closest('[role="dialog"]')
          ) {
            // Added role=dialog for pop-up composers
            return element;
          }
        }
      } else if (item.inputSelector) {
        // If element is a container, find the input within
        const input = element.querySelector(item.inputSelector);
        if (
          input &&
          input.offsetParent !== null &&
          !input.closest('[data-testid="tweetText"]')
        ) {
          const composerParent = input.closest(
            'div[data-testid^="tweetComposer"]'
          );
          const modalComposer = input.closest(
            'div[aria-labelledby="modal-header"]'
          );
          const mainTweetArea = input.closest(
            '[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea_1"]'
          );
          if (
            composerParent ||
            modalComposer ||
            mainTweetArea ||
            input.closest('[role="dialog"]')
          ) {
            return input;
          }
        }
      } else if (item.checkParent) {
        // For generic [contenteditable="true"]
        const parent = element.parentElement;
        const grandParent = parent ? parent.parentElement : null;
        if (
          element.offsetParent !== null &&
          !element.closest('[data-testid="tweetText"]') &&
          ((parent &&
            (parent.getAttribute("data-testid")?.includes("tweetTextarea") ||
              parent.classList.contains("DraftEditor-root"))) ||
            (grandParent &&
              (grandParent
                .getAttribute("data-testid")
                ?.includes("tweetTextarea") ||
                grandParent
                  .getAttribute("data-testid")
                  ?.startsWith("tweetComposer"))) ||
            element.closest('div[aria-labelledby="modal-header"]') || // composer in modal
            element.closest('div[data-testid^="tweetComposer"]')) && // any composer
          element.textContent.length < 500 // Avoid large contenteditable blocks not for tweeting
        ) {
          return element;
        }
      }
    }
  }
  return null;
}

// Function to handle extension context invalidation
function handleExtensionError(
  error,
  contextMessage = "An unexpected error occurred"
) {
  console.error(`ContentScript Error: ${contextMessage}`, error);
  // Also show a toast to the user
  // Ensure getLocalizedString is available and i18n messages are loaded.
  const displayMessage = `${getLocalizedString(
    "errorPrefix",
    "Error:"
  )} ${getLocalizedString(
    "contentScriptErrorEncountered",
    "A problem occurred with the extension. Reloading might help."
  )}`;
  showContentScriptToast(displayMessage, "error", 5000); // Show for 5 seconds
}

// Function to handle clicks outside panels
function handleOutsideClick(event) {
  const suggestionPanel = document.getElementById(SUGGESTION_PANEL_ID);
  const tonePanel = document.getElementById(TONE_PANEL_ID);
  const icon = document.getElementById(ICON_ID);

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

// Function to show loading state
function showLoadingState(panel) {
  const content = panel.querySelector(`.${SUGGESTIONS_CLASS}`);
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
  const content = panel.querySelector(`.${SUGGESTIONS_CLASS}`);
  content.innerHTML = `
    <div style="padding: 8px; text-align: center;">
      <div style="color: var(--error-color); margin-bottom: 12px; font-weight: 500;">${getLocalizedString(
        "errorPrefix"
      )}${error}</div>
      <button class="${RETRY_BUTTON_CLASS}" style="
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

  content
    .querySelector(`.${RETRY_BUTTON_CLASS}`)
    .addEventListener("click", () => {
      const tonePanel = document.getElementById(TONE_PANEL_ID);
      if (tonePanel) {
        panel.style.display = "none";
        tonePanel.style.display = "block";
      }
    });
}

// Function to remove all extension elements
function removeExtensionElements() {
  const elements = [
    document.getElementById(ICON_ID),
    document.getElementById(SUGGESTION_PANEL_ID),
    document.getElementById(TONE_PANEL_ID),
  ];

  elements.forEach((element) => {
    if (element) element.remove();
  });

  document.removeEventListener("click", handleOutsideClick);
  // Clear polling interval if it exists
  if (window.MagicTweetExtension.pollingInterval) {
    clearInterval(window.MagicTweetExtension.pollingInterval);
    window.MagicTweetExtension.pollingInterval = null;
  }
  // Disconnect observer
  if (window.MagicTweetExtension.observer) {
    window.MagicTweetExtension.observer.disconnect();
    // window.MagicTweetExtension.observer = null; // Not strictly needed to nullify if re-created in init
  }
  window.MagicTweetExtension.isInitialized = false; // Reset initialization flag
}

// Helper function to ensure icon and panels are in the DOM
function ensureExtensionElementsExist() {
  let icon = document.getElementById(ICON_ID);
  let suggestionPanel = document.getElementById(SUGGESTION_PANEL_ID);
  let tonePanel = document.getElementById(TONE_PANEL_ID);

  if (!icon) {
    icon = createFloatingIcon();
    if (icon) document.body.appendChild(icon); // Ensure icon was created successfully
  }
  if (!suggestionPanel) {
    suggestionPanel = createSuggestionPanel();
    if (suggestionPanel) {
      document.body.appendChild(suggestionPanel);
      // Listener for the new back button in suggestionPanel's header
      const backButton = suggestionPanel.querySelector(
        ".magic-tweet-header-back-button"
      );
      if (backButton && !backButton.dataset.listenerAttached) {
        // Check if listener already attached
        backButton.addEventListener("click", () => {
          const sPanel = document.getElementById(SUGGESTION_PANEL_ID);
          const tPanel = document.getElementById(TONE_PANEL_ID);
          if (sPanel) sPanel.style.display = "none";
          if (tPanel) tPanel.style.display = "block"; // Show the tone/variation panel
        });
        backButton.dataset.listenerAttached = "true"; // Mark as attached
      }
    }
  }
  if (!tonePanel) {
    tonePanel = createToneSelectionPanel();
    if (tonePanel) document.body.appendChild(tonePanel);
  }
  return { icon, suggestionPanel, tonePanel };
}

// Function to add icon and panels to tweet composer
function addIconToComposer(tweetCompose) {
  if (!tweetCompose) return;

  // Ensure all necessary UI elements exist or are created
  const { icon, suggestionPanel, tonePanel } = ensureExtensionElementsExist();

  // If critical elements like the icon couldn't be created, abort.
  if (!icon) {
    console.error("MagicTweet: Floating icon could not be created or found.");
    return;
  }

  // Define input handler for the tweet composer
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

  // Add input event listener only if it hasn't been added before
  if (!tweetCompose.dataset.magicTweetInputListenerAdded) {
    tweetCompose.addEventListener("input", handleInput);
    tweetCompose.dataset.magicTweetInputListenerAdded = "true";
  }

  // Check initial state
  handleInput();

  // To be absolutely sure we don't attach multiple click listeners to the *same icon instance* if this function is somehow called repeatedly
  // without the icon being re-created, we can use a flag, similar to the input listener.
  if (!icon.dataset.magicTweetClickListenerAdded) {
    icon.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Ensure panels exist and are in the DOM right before we try to show them.
      // This helps prevent issues if elements were removed by other parts of the script (e.g., MutationObserver).
      const { suggestionPanel: liveSuggestionPanel, tonePanel: liveTonePanel } =
        ensureExtensionElementsExist();

      // It's important that ensureExtensionElementsExist appends to body if elements are recreated,
      // and that createToneSelectionPanel()/createSuggestionPanel() correctly initialize them (e.g., hidden).

      const tweetCompose = findTweetComposer(); // Re-check composer, though icon click implies it was there.
      if (!tweetCompose) {
        // If composer disappeared between icon appearing and click, do nothing or hide.
        if (liveSuggestionPanel) liveSuggestionPanel.style.display = "none";
        if (liveTonePanel) liveTonePanel.style.display = "none";
        return;
      }

      const text = tweetCompose.textContent || tweetCompose.innerText || "";
      if (text.trim()) {
        if (liveSuggestionPanel) {
          liveSuggestionPanel.style.display = "none";
        }
        if (liveTonePanel) {
          liveTonePanel.style.display = "block";
          // Re-apply essential styles to ensure visibility and positioning,
          // especially if the panel was just recreated.
          liveTonePanel.style.position = "fixed";
          liveTonePanel.style.right = "38%";
          liveTonePanel.style.top = "calc(14% + 50px)";
          liveTonePanel.style.zIndex = "10000"; // Ensure it's on top
        } else {
          // This case should ideally not be reached if ensureExtensionElementsExist works correctly
          // and createToneSelectionPanel (via ui.js) successfully creates and returns a panel.
          console.error(
            "MagicTweet: Tone panel could not be ensured or found for display after icon click."
          );
        }
      } else {
        // If text becomes empty by the time of click, ensure panels are hidden, consistent with handleInput logic.
        if (liveSuggestionPanel) liveSuggestionPanel.style.display = "none";
        if (liveTonePanel) liveTonePanel.style.display = "none";
      }
    });
    icon.dataset.magicTweetClickListenerAdded = "true";
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
    container.innerHTML = `<div class="${ERROR_CLASS}" style="color: #E0245E;">${getLocalizedString(
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
      container.innerHTML = `<div class="${ERROR_CLASS}" style="color: #E0245E;">${getLocalizedString(
        "errorNoSuggestionsAvailable"
      )}</div>`;
      return;
    }

    // Now we can safely use forEach since we know suggestionsToDisplay is an array
    suggestionsToDisplay.forEach((suggestion) => {
      if (!suggestion || !suggestion.variations) return;

      const suggestionDiv = document.createElement("div");
      suggestionDiv.className = SUGGESTION_CLASS;
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
          <div class="${VARIATION_CLASS}" style="
            /* position: relative; removed */
            overflow: hidden; /* Contain the floated button */
            margin-bottom: 8px;
            padding: 8px; /* Overall padding */
            background: #FFFFFF;
            border: 1px solid #E1E8ED;
            border-radius: 6px;
            color: #14171A;
          ">
            <div class="${TEXT_CLASS}" style="
              color: #14171A;
              /* Side padding removed */
            ">${text}</div>
            <button class="${COPY_BUTTON_CLASS}" style="
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
        <div class="${TONE_TEXT_CLASS}" style="
          font-weight: 500;
          margin-bottom: 8px;
          color: #14171A;
        ">${tone}</div>
        <div class="magic-tweet-variations">${variationsHtml}</div>
      `;

      suggestionDiv
        .querySelectorAll(`.${COPY_BUTTON_CLASS}`)
        .forEach((button) => {
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

              // REMOVED: document.getElementById(SUGGESTION_PANEL_ID).style.display = "none";
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

    // Instead, directly theme the new elements based on global theme state
    themeNewlyAddedSuggestions(
      container,
      window.MagicTweetExtension.currentThemeIsDark
    );
  } catch (error) {
    console.error("Error displaying suggestions:", error);
    container.innerHTML = `<div class="${ERROR_CLASS}" style="color: #E0245E;">${getLocalizedString(
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
  if (
    window.MagicTweetExtension.isInitialized &&
    document.getElementById(ICON_ID)
  ) {
    // If already initialized and icon exists, try to re-attach to a new composer if found,
    // but don't re-run full initialization.
    const tweetCompose = findTweetComposer();
    if (tweetCompose && !document.getElementById(ICON_ID).isConnected) {
      // Check if icon got detached
      const icon = document.getElementById(ICON_ID);
      // Re-add icon logic or ensure addIconToComposer handles this scenario
      // For now, we rely on the MutationObserver and polling to re-add if necessary
      // Or, if icon exists but isn't properly attached to *this* composer:
      // removeExtensionElements(); // Clean up old state
      // window.MagicTweetExtension.isInitialized = false; // force re-init by falling through
    } else if (tweetCompose && document.getElementById(ICON_ID)) {
      // Icon exists and a composer is found. Ensure event listeners are current if composer changed.
      // This might be complex, for now, allow re-init if current composer doesn't have icon logic
      const currentIcon = document.getElementById(ICON_ID);
      if (
        currentIcon &&
        currentIcon.style.display === "none" &&
        (tweetCompose.textContent || tweetCompose.innerText)
      ) {
        // If icon is hidden but should be visible for current composer, refresh its state
        addIconToComposer(tweetCompose);
      }
      return; // Already initialized and seems okay
    }
  }

  // Prevent re-initialization for a short period if recently attempted
  const now = Date.now();
  if (
    window.MagicTweetExtension.lastInitAttempt &&
    now - window.MagicTweetExtension.lastInitAttempt < 1000
  ) {
    return;
  }
  window.MagicTweetExtension.lastInitAttempt = now;

  // Get initial language from storage
  try {
    const result = await new Promise((resolve) =>
      chrome.storage.local.get("userLanguage", resolve)
    );
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
  await initTheme(); // Ensure this is awaited as initTheme is now async

  // Check if already initialized by another trigger (e.g. rapid mutation or polling)
  // This check is crucial to avoid multiple initializations.
  if (
    window.MagicTweetExtension.isInitialized &&
    document.getElementById(ICON_ID)
  ) {
    const composer = findTweetComposer();
    if (composer && document.getElementById(ICON_ID)) {
      // If composer found and icon exists, make sure it's linked
      // Call addIconToComposer to ensure listeners are attached to the *current* composer
      // addIconToComposer already checks if icon exists and creates if not.
      // It also re-adds listeners, which is what we want if composer changed.
      addIconToComposer(composer);
    }
    return;
  }

  try {
    // Clear any existing observers before creating a new one
    if (window.MagicTweetExtension.observer) {
      window.MagicTweetExtension.observer.disconnect();
    }

    const observer = new MutationObserver(
      debounce((mutations) => {
        // Filter out mutations caused by the extension itself
        if (
          mutations.some(
            (mutation) =>
              (mutation.target.id &&
                mutation.target.id.startsWith(EXT_NAMESPACE + "-")) ||
              (mutation.target.closest &&
                mutation.target.closest('[id^="' + EXT_NAMESPACE + '-"]')) ||
              (mutation.addedNodes &&
                Array.from(mutation.addedNodes).some(
                  (node) => node.id && node.id.startsWith(EXT_NAMESPACE + "-")
                )) ||
              (mutation.removedNodes &&
                Array.from(mutation.removedNodes).some(
                  (node) => node.id && node.id.startsWith(EXT_NAMESPACE + "-")
                ))
          )
        ) {
          return;
        }

        const tweetCompose = findTweetComposer();
        const icon = document.getElementById(ICON_ID);

        if (!tweetCompose && icon && icon.isConnected) {
          // Check if icon is still in DOM
          removeExtensionElements(); // This will also clear polling interval
          window.MagicTweetExtension.isInitialized = false; // Ready for re-init if composer reappears
          return;
        }

        if (tweetCompose) {
          // If composer found, ensure icon and panels are set up for it.
          // addIconToComposer will create/append elements if they don't exist
          // or ensure they are correctly associated with the current composer.
          addIconToComposer(tweetCompose);
          // initTheme(); // theme is handled by addIconToComposer/createPanel or globally.
        }
      }, 300) // Reduced debounce time slightly
    );

    // Try to observe a more specific part of the page if possible.
    // For Twitter, #react-root or a main content div might be candidates.
    // Defaulting to document.body if a better selector isn't easily identifiable now.
    let observeTarget = document.body;
    const reactRoot = document.getElementById("react-root");
    if (reactRoot) {
      // Twitter often uses #react-root
      const mainContent = reactRoot.querySelector("main"); // A common structure within react-root
      if (mainContent) observeTarget = mainContent;
      else observeTarget = reactRoot;
    }

    observer.observe(observeTarget, {
      childList: true,
      subtree: true,
    });

    window.MagicTweetExtension.observer = observer;

    // Initial check
    const initialTweetCompose = findTweetComposer();
    if (initialTweetCompose) {
      addIconToComposer(initialTweetCompose);
    }

    // Fallback polling mechanism
    if (window.MagicTweetExtension.pollingInterval) {
      clearInterval(window.MagicTweetExtension.pollingInterval);
    }
    window.MagicTweetExtension.pollingInterval = setInterval(() => {
      const composer = findTweetComposer();
      const icon = document.getElementById(ICON_ID);
      if (composer && (!icon || !icon.isConnected)) {
        // If composer exists but icon doesn't or is detached
        console.log(
          "Polling: Composer found, icon missing/detached. Adding icon."
        );
        addIconToComposer(composer);
      } else if (!composer && icon && icon.isConnected) {
        console.log(
          "Polling: No composer, but icon exists. Removing elements."
        );
        removeExtensionElements();
        window.MagicTweetExtension.isInitialized = false;
      } else if (composer && icon && icon.isConnected) {
        // If both exist, ensure the input handler is correctly updating visibility
        // This is mostly handled by addIconToComposer if it's called, or by the input listener.
        // We can also explicitly call the handler if needed.
        const text = composer.textContent || composer.innerText || "";
        const isEmpty =
          !text.trim() || text === "" || text === "\\n" || text === "\\r\\n";
        if (icon.style.display === (isEmpty ? "flex" : "none")) {
          // If state is inverted
          icon.style.display = isEmpty ? "none" : "flex";
        }
      }
    }, 1500); // Check every 1.5 seconds

    window.MagicTweetExtension.isInitialized = true;
  } catch (error) {
    handleExtensionError(error); // This already resets isInitialized and attempts re-init
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

// NEW FUNCTION: Show a toast notification on the page
function showContentScriptToast(message, type = "error", duration = 4000) {
  let toastElement = document.getElementById(TOAST_ID);
  if (!toastElement) {
    toastElement = document.createElement("div");
    toastElement.id = TOAST_ID;
    // Apply styles BEFORE appending to avoid reflow if possible, though for a single element it's minor.
    toastElement.style.position = "fixed";
    toastElement.style.top = "20px";
    toastElement.style.left = "50%";
    toastElement.style.transform = "translateX(-50%)";
    toastElement.style.padding = "12px 20px"; // Increased padding slightly
    toastElement.style.borderRadius = "8px";
    toastElement.style.zIndex = "20000"; // High z-index
    toastElement.style.color = "white";
    toastElement.style.textAlign = "center";
    toastElement.style.fontSize = "14px"; // Explicit font size
    toastElement.style.fontWeight = "500"; // Slightly bolder
    toastElement.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    toastElement.style.fontFamily =
      'TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    toastElement.style.opacity = "0"; // Start hidden for transition
    toastElement.style.visibility = "hidden";
    toastElement.style.transition =
      "opacity 0.3s ease-in-out, visibility 0.3s ease-in-out, top 0.3s ease-in-out"; // Added top transition

    document.body.appendChild(toastElement);
  }

  toastElement.textContent = message;

  if (type === "error") {
    toastElement.style.backgroundColor = "#E0245E"; // Twitter error red
  } else if (type === "success") {
    toastElement.style.backgroundColor = "#17BF63"; // Twitter success green
  } else {
    // Default/info
    toastElement.style.backgroundColor = "#1DA1F2"; // Twitter blue
  }

  // Show toast by moving it down slightly and fading in
  requestAnimationFrame(() => {
    toastElement.style.top = "30px"; // End position when visible
    toastElement.style.visibility = "visible";
    toastElement.style.opacity = "1";
  });

  // Hide after duration by moving it back up and fading out
  setTimeout(() => {
    toastElement.style.top = "20px"; // Start position before hiding
    toastElement.style.opacity = "0";
    // Set visibility to hidden after transition ends
    setTimeout(() => {
      if (toastElement.style.opacity === "0") {
        // Check if it's still meant to be hidden
        toastElement.style.visibility = "hidden";
      }
    }, 300); // Matches transition duration
  }, duration);
}
