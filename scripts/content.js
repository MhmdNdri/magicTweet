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

// Video Download Feature Constants
const VIDEO_DOWNLOAD_ICON_ID = `${EXT_NAMESPACE}-video-download-icon`;
const VIDEO_DOWNLOAD_MODAL_ID = `${EXT_NAMESPACE}-video-download-modal`;

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
  ROAST: "styleRoast",
};

const AI_PROVIDER_KEY = "magic-tweet-ai-provider"; // Added for consistency

// Video Download Service Configuration
const VIDEO_DOWNLOAD_SERVICE_URL =
  "https://web-production-5536a.up.railway.app"; // Railway deployed Python server

// Video Detection Functions
function findVideoElements() {
  const videoSelectors = [
    "video", // Direct video elements
    '[data-testid="videoPlayer"]', // Twitter video player
    '[data-testid="videoComponent"]', // Twitter video component
    '[data-testid="videoPlayer-video"]', // Specific video player elements
  ];

  const foundVideos = [];

  videoSelectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);

    elements.forEach((element) => {
      // Check if element is visible and not already processed
      if (
        element.offsetParent !== null &&
        !element.dataset.magicTweetVideoProcessed &&
        isActualVideoElement(element)
      ) {
        const container =
          element.closest('[data-testid="tweet"]') ||
          element.closest("article") ||
          element.closest('[data-testid*="media"]'); // Also try media containers

        foundVideos.push({
          element: element,
          type: "video",
          container: container,
        });
        element.dataset.magicTweetVideoProcessed = "true";
      }
    });
  });

  // Also specifically look for video elements with more specific criteria
  const directVideos = document.querySelectorAll("video");
  directVideos.forEach((video) => {
    if (
      video.offsetParent !== null &&
      !video.dataset.magicTweetVideoProcessed &&
      video.src // Must have a source
    ) {
      const container =
        video.closest('[data-testid="tweet"]') ||
        video.closest("article") ||
        video.closest('[data-testid*="media"]');

      foundVideos.push({
        element: video,
        type: "video",
        container: container,
      });
      video.dataset.magicTweetVideoProcessed = "true";
    }
  });

  return foundVideos;
}

function isActualVideoElement(element) {
  // Filter out non-video elements that might match our selectors

  // If it's a direct video element, it's valid
  if (element.tagName === "VIDEO") {
    return true;
  }

  const className =
    (element.className && element.className.toString
      ? element.className.toString()
      : element.className) || "";
  const testId = element.getAttribute("data-testid") || "";

  // Exclude profile/avatar related elements (most important filter)
  if (
    className.includes("avatar") ||
    className.includes("profile") ||
    testId.includes("avatar") ||
    testId.includes("profile") ||
    element.closest('[data-testid*="avatar"]') ||
    element.closest('[data-testid*="profile"]')
  ) {
    return false;
  }

  // For container elements, check if they contain video or have video-related attributes
  const hasVideo = element.querySelector("video") !== null;
  const hasVideoAttributes =
    testId.includes("video") || testId.includes("Player");

  if (!hasVideo && !hasVideoAttributes) {
    return false;
  }
  return true;
}

function findGifElements() {
  const gifSelectors = [
    '[data-testid*="gif"]', // Twitter GIF containers
    '[data-testid="tweetPhoto"]', // Tweet photo containers that might contain GIFs
    '[data-testid="media"]', // General media containers
    ".gif-player", // GIF player elements
    '[aria-label*="GIF"]', // Elements with GIF aria-label
    '[aria-label*="gif"]', // Elements with lowercase gif aria-label
    'img[src*=".gif"]', // Direct GIF images
    'img[src*="gif"]', // Images with gif in URL
    'video[poster*="gif"]', // Videos with GIF posters
    '[role="img"]', // Images that might be GIFs
  ];

  const foundGifs = [];

  gifSelectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      // Check if element is visible and not already processed
      if (
        element.offsetParent !== null &&
        !element.dataset.magicTweetGifProcessed &&
        isActualGifElement(element)
      ) {
        foundGifs.push({
          element: element,
          type: "gif",
          container:
            element.closest('[data-testid="tweet"]') ||
            element.closest("article"),
        });
        element.dataset.magicTweetGifProcessed = "true";
      }
    });
  });

  // Also specifically look for actual GIF images, but be more selective
  const gifImages = document.querySelectorAll(
    'img[src*=".gif"], img[src*="gif"]'
  );
  gifImages.forEach((img) => {
    if (
      img.offsetParent !== null &&
      !img.dataset.magicTweetGifProcessed &&
      (img.src.includes(".gif") || img.src.includes("gif")) && // Must actually be a GIF
      isActualGifElement(img)
    ) {
      foundGifs.push({
        element: img,
        type: "gif",
        container:
          img.closest('[data-testid="tweet"]') || img.closest("article"),
      });
      img.dataset.magicTweetGifProcessed = "true";
    }
  });

  return foundGifs;
}

function isActualGifElement(element) {
  // Filter out non-GIF elements that might match our selectors

  const className =
    (element.className && element.className.toString
      ? element.className.toString()
      : element.className) || "";
  const testId = element.getAttribute("data-testid") || "";

  // Exclude profile pictures, avatars, and other non-media content
  if (
    className.includes("avatar") ||
    className.includes("profile") ||
    testId.includes("avatar") ||
    testId.includes("profile") ||
    element.closest('[data-testid*="avatar"]') ||
    element.closest('[data-testid*="profile"]')
  ) {
    return false;
  }

  // Check if it's explicitly a photo (and not a GIF)
  const isExplicitPhoto =
    (testId.includes("photo") && !testId.includes("gif")) ||
    (testId.includes("image") && !testId.includes("gif")) ||
    (element.tagName === "IMG" &&
      element.src &&
      !element.src.includes("gif") &&
      !element.src.includes("video") &&
      (element.src.includes(".jpg") ||
        element.src.includes(".jpeg") ||
        element.src.includes(".png") ||
        element.src.includes(".webp"))) ||
    (element.getAttribute("aria-label")?.toLowerCase().includes("photo") &&
      !element.getAttribute("aria-label")?.toLowerCase().includes("gif")) ||
    (element.getAttribute("aria-label")?.toLowerCase().includes("image") &&
      !element.getAttribute("aria-label")?.toLowerCase().includes("gif"));

  if (isExplicitPhoto) {
    return false;
  }

  // Check if it actually contains GIF content, is a GIF itself, or is a video
  const hasGifContent =
    // Explicit GIF indicators
    testId.includes("gif") ||
    className.includes("gif") ||
    element.getAttribute("aria-label")?.toLowerCase().includes("gif") ||
    (element.src && element.src.includes("gif")) ||
    (element.tagName === "IMG" && element.src && element.src.includes("gif")) ||
    element.querySelector("img[src*='gif']") ||
    element.querySelector("video[poster*='gif']") ||
    // Video elements (for GIFs that might be served as videos)
    element.tagName === "VIDEO" ||
    element.querySelector("video") ||
    testId.includes("video") ||
    // Media containers that might contain GIFs or videos (but not static photos)
    (testId.includes("media") && !isExplicitPhoto) ||
    (testId.includes("Photo") && !isExplicitPhoto);

  if (!hasGifContent) {
    return false;
  }
  return true;
}

function findAllMediaElements() {
  const videos = findVideoElements();
  const gifs = findGifElements();
  return [...videos, ...gifs];
}

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
    // Define tone icons mapping (same as in ui.js) - now with inline SVG
    const TONE_ICONS = {
      styleSarcastic: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M15.5 11c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#FFA500"/></svg>`,
      tonePlayfulFunny: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M2 20h20l-2-2v-2h-5.5l-.5-4h1c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h1l-.5 4H7v2l-2 2zm3.5-3h13l.5.5h-14l.5-.5zm2.5-7V7h4v3h-4z" fill="#FF6B6B"/></svg>`,
      toneRomanticSoft: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#E91E63"/></svg>`,
      toneMelancholicPoetic: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zM3 18.5V7c1.1-.35 2.3-.5 3.5-.5 1.34 0 3.13.41 4.5.99v11.5C9.63 18.41 7.84 18 6.5 18c-1.2 0-2.4.15-3.5.5z" fill="#6A4C93"/></svg>`,
      toneHopefulUplifting: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" fill="#4CAF50"/></svg>`,
      toneCynicalDarkHumor: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M9 12A5 5 0 0 0 14 7h-5v5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#607D8B"/></svg>`,
      toneOverdramaticTheatrical: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M2 16.5C2 19.54 4.46 22 7.5 22s5.5-2.46 5.5-5.5V10H2v6.5zM7.5 20C5.57 20 4 18.43 4 16.5V12h7v4.5C11 18.43 9.43 20 7.5 20zM16.5 22C19.54 22 22 19.54 22 16.5V10h-11v6.5C11 19.54 13.46 22 16.5 22zM13 12h7v4.5C20 18.43 18.43 20 16.5 20S13 18.43 13 16.5V12zM12 8.5c0-2.49-2.01-4.5-4.5-4.5S3 6.01 3 8.5H12zM21 8.5c0-2.49-2.01-4.5-4.5-4.5S12 6.01 12 8.5H21z" fill="#9C27B0"/></svg>`,
      toneMinimalistDry: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="#795548"/></svg>`,
      toneInspirationalMotivational: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z" fill="#FF9800"/></svg>`,
      styleRoast: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" fill="#F44336"/></svg>`,
    };

    // Iterate over the API_TONE_MESSAGE_KEYS to ensure consistent button order and data
    let toneButtonsHtml = '<div class="magic-tweet-tone-grid">';
    for (const internalKey in API_TONE_MESSAGE_KEYS) {
      const messageKey = API_TONE_MESSAGE_KEYS[internalKey];
      const localizedText = getLocalizedString(messageKey); // Get current localized text
      const icon =
        TONE_ICONS[messageKey] ||
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;

      toneButtonsHtml += `
        <div class="magic-tweet-tone-item" data-tone-api-key="${messageKey}">
          <div class="magic-tweet-tone-icon">
            ${icon}
          </div>
          <span class="magic-tweet-tone-label">${localizedText}</span>
        </div>
      `;
    }
    toneButtonsHtml += "</div>";
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

  // Update to use the new class name for tone items
  tonePanel.querySelectorAll(".magic-tweet-tone-item").forEach((toneItem) => {
    // Remove existing listeners by cloning
    const newToneItem = toneItem.cloneNode(true);
    toneItem.parentNode.replaceChild(newToneItem, toneItem);

    const toneApiKey = newToneItem.dataset.toneApiKey;
    if (!toneApiKey) return;

    // Add hover effects
    newToneItem.addEventListener("mouseover", () => {
      // Hover effects are now handled by CSS
    });

    newToneItem.addEventListener("mouseout", () => {
      // Hover effects are now handled by CSS
    });

    newToneItem.addEventListener("click", async () => {
      const tweetCompose = findTweetComposer();
      const text = tweetCompose
        ? tweetCompose.textContent || tweetCompose.innerText
        : null;

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

        // --- Start of new error handling for sendMessage ---
        try {
          if (!chrome.runtime || !chrome.runtime.id) {
            console.warn(
              "ContentScript: Runtime context is invalid before sending message for suggestions."
            );
            showContentScriptToast(
              getLocalizedString(
                "errorExtensionNeedsReload",
                "Extension context lost. Please try reloading the extension or page."
              ),
              "warning",
              7000
            );
            // Hide loading state if shown
            if (currentSuggestionPanel) {
              const suggestionsContainer = currentSuggestionPanel.querySelector(
                `.${SUGGESTIONS_CLASS}`
              );
              if (suggestionsContainer) suggestionsContainer.innerHTML = ""; // Clear loading
            }
            return;
          }

          const response = await chrome.runtime.sendMessage({
            action: "generateSuggestions",
            text: text,
            tone: toneApiKey,
            aiProvider: aiProvider,
          });

          if (chrome.runtime.lastError) {
            if (
              chrome.runtime.lastError.message &&
              (chrome.runtime.lastError.message.includes(
                "Extension context invalidated"
              ) ||
                chrome.runtime.lastError.message.includes(
                  "Receiving end does not exist"
                ))
            ) {
              console.warn(
                "ContentScript: sendMessage failed - Extension context invalidated or receiving end missing.",
                chrome.runtime.lastError.message
              );
              showContentScriptToast(
                getLocalizedString(
                  "errorExtensionNeedsReload",
                  "Extension context lost. Please try reloading the extension or page."
                ),
                "warning",
                7000
              );
              if (currentSuggestionPanel) {
                const suggestionsContainer =
                  currentSuggestionPanel.querySelector(`.${SUGGESTIONS_CLASS}`);
                if (suggestionsContainer) suggestionsContainer.innerHTML = ""; // Clear loading
              }
              return;
            }
            // For other lastErrors, throw to be caught by the main catch block
            throw new Error(chrome.runtime.lastError.message);
          }
          // --- End of new error handling for sendMessage ---

          const freshSuggestionPanel =
            document.getElementById(SUGGESTION_PANEL_ID);
          if (!freshSuggestionPanel) return; // Panel might have been removed

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
              // Handle the case where user needs to log in with a better UI
              showLoginRequiredError(freshSuggestionPanel);
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
          // Log the actual error object and message to be sure
          console.error(
            "ContentScript: CAUGHT ERROR in generateSuggestions click handler:",
            error
          );
          console.error("ContentScript: Error message was:", error.message);
          console.error("ContentScript: Error name was:", error.name);
          console.error(
            "ContentScript: Error stack:",
            error.stack ? error.stack.substring(0, 500) : "No stack"
          );

          // Check if the error is due to invalidated context
          if (
            error.message &&
            (error.message
              .toLowerCase()
              .includes("extension context invalidated") || // make it case-insensitive
              error.message
                .toLowerCase()
                .includes("receiving end does not exist"))
          ) {
            // make it case-insensitive
            console.warn(
              "ContentScript: Matched context error - Showing 'needs reload' toast.",
              error.message
            );
            showContentScriptToast(
              getLocalizedString(
                "errorExtensionNeedsReload",
                "Extension context lost. Please try reloading the extension or page."
              ),
              "warning",
              7000
            );
          } else {
            console.warn(
              "ContentScript: Did NOT match context error - Showing generic error."
            );
            // Fallback to generic error display for other errors
            const errorDisplayPanel =
              document.getElementById(SUGGESTION_PANEL_ID);
            if (errorDisplayPanel) {
              showError(
                errorDisplayPanel,
                error.message || getLocalizedString("errorFailedSuggestions")
              );
            }
          }
          // Ensure loading is cleared from panel if it was shown
          const panelToClear = document.getElementById(SUGGESTION_PANEL_ID);
          if (panelToClear) {
            const suggestionsContainer = panelToClear.querySelector(
              `.${SUGGESTIONS_CLASS}`
            );
            if (suggestionsContainer) suggestionsContainer.innerHTML = "";
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
    ROAST: getLocalizedString(API_TONE_MESSAGE_KEYS.ROAST, "Roast"),
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
  // console.log("MagicTweet: findTweetComposer() CALLED."); // Can be very noisy, disable for now
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
  // console.log("MagicTweet: findTweetComposer() FAILED to find composer."); // Disable for now
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
        color: var(--button-text-color);
        border: none;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
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

// Function to show a user-friendly login required error
function showLoginRequiredError(panel) {
  const content = panel.querySelector(`.${SUGGESTIONS_CLASS}`);
  content.innerHTML = `
    <div style="
      padding: 20px; 
      text-align: center; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      margin: 8px;
      color: white;
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
    ">
      <div style="
        font-size: 18px; 
        font-weight: 600; 
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4"/>
          <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
          <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
          <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
          <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
        </svg>
        ${getLocalizedString("loginRequired")}
      </div>
      <div style="
        margin-bottom: 16px; 
        opacity: 0.95;
        line-height: 1.4;
      ">
        ${getLocalizedString("loginRequiredMessage")}
      </div>
      <button class="magic-tweet-login-button" style="
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(10px);
        padding: 10px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: all 0.3s ease;
        margin: 4px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-2px)'" 
         onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10,17 15,12 10,7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        ${getLocalizedString("loginButtonText")}
      </button>
      <div style="
        margin-top: 12px;
        font-size: 12px;
        opacity: 0.8;
        line-height: 1.3;
      ">
        ${getLocalizedString("guidanceOpenPopupToLogin")}
      </div>
    </div>
  `;

  // Add click handler for the login button
  content
    .querySelector(".magic-tweet-login-button")
    .addEventListener("click", () => {
      // Open the extension popup (this will vary based on browser)
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        // Fallback: show a toast message with instructions
        showContentScriptToast(
          getLocalizedString("guidanceOpenPopupToLogin") ||
            "Please click the extension icon to login",
          "info",
          5000
        );
      }
    });
}

// Function to add download icon to video/gif elements
function addDownloadIconToMedia(mediaItem) {
  if (!mediaItem || !mediaItem.element) {
    return;
  }

  const { element, type, container } = mediaItem;

  // Check if download icon already exists for this element
  if (element.querySelector(`#${VIDEO_DOWNLOAD_ICON_ID}`)) {
    return;
  }

  // Check if extension context is still valid before creating icon
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn(
        "Extension context invalidated, skipping download icon creation"
      );
      return;
    }
  } catch (contextError) {
    console.warn(
      "Extension context invalidated, skipping download icon creation"
    );
    return;
  }

  // Create download icon
  const downloadIcon = createVideoDownloadIcon();
  if (!downloadIcon) {
    return;
  }

  // Position the icon relative to the media element
  const mediaContainer =
    element.closest('[data-testid*="media"]') ||
    element.closest('[data-testid*="video"]') ||
    element.closest('[data-testid*="gif"]') ||
    element;

  if (mediaContainer) {
    // Ensure the container has relative positioning
    const computedStyle = window.getComputedStyle(mediaContainer);

    if (computedStyle.position === "static") {
      mediaContainer.style.position = "relative";
    }

    // Add the download icon to the container
    mediaContainer.appendChild(downloadIcon);

    // Show icon on hover
    const showIcon = () => {
      downloadIcon.style.display = "flex";
    };

    const hideIcon = () => {
      downloadIcon.style.display = "none";
    };

    mediaContainer.addEventListener("mouseenter", showIcon);
    mediaContainer.addEventListener("mouseleave", hideIcon);

    // Add click handler to download icon
    downloadIcon.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log(`Download ${type} clicked:`, element);

      // Use the new quality selection modal
      await handleVideoDownload({ element, type, container });
    });
  }
}

// Helper function to check if element is actually a photo (conservative approach)
function isPhotoElement(element) {
  // If it's a video element, it's definitely not a photo
  if (element.tagName === "VIDEO") {
    return false;
  }

  // If it has video-related test IDs, it's not a photo
  const testId = element.getAttribute("data-testid") || "";
  if (testId.includes("video") && !testId.includes("photo")) {
    return false;
  }

  // If it's explicitly in a video container, it's not a photo
  if (
    element.closest('video, [data-testid*="video"]:not([data-testid*="photo"])')
  ) {
    return false;
  }

  // Only flag as photo if it's clearly a photo element
  // Profile pictures and avatars
  if (testId.includes("avatar") || testId.includes("profile")) {
    return true;
  }

  // Explicit photo containers
  if (testId.includes("photo") || testId.includes("image")) {
    return true;
  }

  // IMG elements that are clearly photos (not video thumbnails or GIF frames)
  if (element.tagName === "IMG") {
    const src = element.src || "";
    const alt = element.alt || "";

    // Profile/avatar images
    if (
      alt.includes("avatar") ||
      alt.includes("profile") ||
      src.includes("profile")
    ) {
      return true;
    }

    // Tweet photo containers
    if (element.closest('[data-testid="tweetPhoto"], [aria-label*="Image"]')) {
      return true;
    }
  }

  return false;
}

// Function to scan for and process media elements
function scanForMediaElements() {
  const videoElements = findVideoElements();
  const gifElements = findGifElements();
  const mediaElements = [...videoElements, ...gifElements];

  // Process media elements
  mediaElements.forEach((mediaItem) => {
    addDownloadIconToMedia(mediaItem);
  });
}

// Function to remove all extension elements
function removeExtensionElements() {
  // REMOVED: console.log("MagicTweet: removeExtensionElements() CALLED.");
  const elements = [
    document.getElementById(ICON_ID),
    document.getElementById(SUGGESTION_PANEL_ID),
    document.getElementById(TONE_PANEL_ID),
  ];

  // Also remove video download icons
  const videoDownloadIcons = document.querySelectorAll(
    `#${VIDEO_DOWNLOAD_ICON_ID}`
  );
  videoDownloadIcons.forEach((icon) => icon.remove());

  elements.forEach((element) => {
    if (element) element.remove();
  });

  document.removeEventListener("click", handleOutsideClick);
  // Clear polling interval if it exists
  if (window.MagicTweetExtension.pollingInterval) {
    // REMOVED: console.log("MagicTweet: Clearing polling interval ID: ...");
    clearInterval(window.MagicTweetExtension.pollingInterval);
    window.MagicTweetExtension.pollingInterval = null;
  }
  // Disconnect observer
  if (window.MagicTweetExtension.observer) {
    // REMOVED: console.log("MagicTweet: Disconnecting MutationObserver.");
    window.MagicTweetExtension.observer.disconnect();
  }
  window.MagicTweetExtension.isInitialized = false; // Reset initialization flag
  // REMOVED: console.log("MagicTweet: removeExtensionElements() COMPLETED. isInitialized: false.");
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

// Debounce function (ensure it's defined before use, typically at the top or in a utility section)
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
  // REMOVED: console.log(`MagicTweet: initialize() ENTRY. isInitialized: ${
  //   window.MagicTweetExtension.isInitialized
  // }, Icon DOM: ${!!document.getElementById(ICON_ID)}`);

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

    const observerCallback = debounce((mutations) => {
      if (!mutations || typeof mutations.some !== "function") {
        const composerCheck = findTweetComposer();
        if (composerCheck && !document.getElementById(ICON_ID)) {
          // Potentially keep a very specific log for this rare case if needed for future issues.
          // console.log("MagicTweet Observer (no mutations check): Composer found, icon missing. Adding icon.");
          addIconToComposer(composerCheck);
        }
        return;
      }

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
        return; // Ignore self-mutations
      }

      const tweetCompose = findTweetComposer();
      // REMOVED: console.log(`MagicTweet Observer: findTweetComposer result: ${
      //   tweetCompose ? "Found" : "Not Found"
      // }`);

      const icon = document.getElementById(ICON_ID);
      if (!tweetCompose && icon && icon.isConnected) {
        // REMOVED: console.log("MagicTweet Observer: Composer GONE, icon exists. ...");
        removeExtensionElements();
        return;
      }
      if (tweetCompose) {
        addIconToComposer(tweetCompose);
      }

      // Scan for media elements (videos/GIFs) whenever DOM changes
      scanForMediaElements();
    }, 300);

    window.MagicTweetExtension.observer = new MutationObserver(
      observerCallback
    );

    let observeTarget = document.body;
    if (document.getElementById("react-root")) {
      observeTarget = document.getElementById("react-root");
      const mainContent = observeTarget.querySelector("main");
      if (mainContent) observeTarget = mainContent;
    }

    window.MagicTweetExtension.observer.observe(observeTarget, {
      childList: true,
      subtree: true,
    });

    const initialTweetCompose = findTweetComposer();
    if (initialTweetCompose) {
      // REMOVED: console.log("MagicTweet initialize: Initial composer found, adding icon.");
      addIconToComposer(initialTweetCompose);
    }

    // Initial scan for media elements
    scanForMediaElements();

    // Fallback polling mechanism
    if (window.MagicTweetExtension.pollingInterval) {
      clearInterval(window.MagicTweetExtension.pollingInterval);
    }
    window.MagicTweetExtension.pollingInterval = setInterval(() => {
      const composer = findTweetComposer();
      const icon = document.getElementById(ICON_ID);
      if (composer && (!icon || !icon.isConnected)) {
        // If composer exists but icon doesn't or is detached
        console.log("MagicTweet Polling: Action - Adding icon.");
        addIconToComposer(composer);
      } else if (!composer && icon && icon.isConnected) {
        console.log("MagicTweet Polling: Action - Removing elements.");
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

      // Also scan for media elements periodically
      scanForMediaElements();
    }, 1500); // Check every 1.5 seconds

    window.MagicTweetExtension.isInitialized = true;
  } catch (error) {
    handleExtensionError(error); // This already resets isInitialized and attempts re-init
  }
  // REMOVED: console.log("MagicTweet: initialize() EXIT.");
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

// --- SPA Navigation Handling (with debounce) ---
const debouncedInitialize = debounce(() => {
  // REMOVED: console.log("MagicTweet: Debounced initialize triggered by SPA navigation.");
  initialize();
}, 300);

function handleSPAnavigation() {
  // REMOVED: console.log("MagicTweet: SPA navigation event detected.");
  debouncedInitialize();
}

window.addEventListener("popstate", handleSPAnavigation);

const originalPushState = history.pushState;
history.pushState = function () {
  originalPushState.apply(this, arguments);
  handleSPAnavigation();
};

const originalReplaceState = history.replaceState;
history.replaceState = function () {
  originalReplaceState.apply(this, arguments);
  handleSPAnavigation();
};
// --- End SPA Navigation Handling ---

// Video download functionality
async function handleVideoDownload(mediaItem) {
  const videoUrl = getVideoUrlFromElement(mediaItem.element);

  if (!videoUrl) {
    showContentScriptToast("Could not extract video URL", "error", 3000);
    return;
  }

  // Create and show modal
  const modal = createVideoDownloadModal();
  // Store the mediaItem in the modal for later use
  modal.mediaItem = mediaItem;
  document.body.appendChild(modal);
  modal.style.display = "block";

  try {
    // Get video info from your backend
    const videoInfo = await getVideoInfo(videoUrl);

    if (!videoInfo.success) {
      showErrorInModal(
        modal,
        videoInfo.message || videoInfo.error || "Failed to analyze video"
      );
      return;
    }

    // Show quality selection
    showQualitySelection(modal, videoInfo, videoUrl);
  } catch (error) {
    console.error("Error getting video info:", error);
    showErrorInModal(modal, "Failed to analyze video. Please try again.");
  }
}

function getVideoUrlFromElement(element) {
  // Try to extract the Twitter video URL
  const tweetElement =
    element.closest('[data-testid="tweet"]') || element.closest("article");
  if (!tweetElement) return null;

  // Look for tweet link
  const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
  if (tweetLink) {
    return tweetLink.href;
  }

  // Fallback: try to get from current page URL if we're on a tweet page
  if (window.location.href.includes("/status/")) {
    return window.location.href;
  }

  return null;
}

async function getVideoInfo(url) {
  try {
    // Convert x.com URLs to twitter.com URLs for yt-dlp compatibility
    const twitterUrl = url.replace("x.com", "twitter.com");

    const response = await chrome.runtime.sendMessage({
      action: "getVideoInfo",
      videoUrl: twitterUrl,
    });

    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }

    return response;
  } catch (error) {
    console.error("Error getting video info:", error);
    return {
      success: false,
      error: "Network error",
      message: "Could not connect to download service",
    };
  }
}

function showQualitySelection(modal, videoInfo, videoUrl) {
  const loadingState = modal.querySelector(".loading-state");
  const qualitySelection = modal.querySelector(".quality-selection");

  // Hide loading, show quality selection
  loadingState.style.display = "none";
  qualitySelection.style.display = "block";

  // Populate video info
  const thumbnail = modal.querySelector(".video-thumbnail");
  const title = modal.querySelector(".video-title");
  const author = modal.querySelector(".video-author");
  const duration = modal.querySelector(".video-duration");

  if (videoInfo.thumbnail) {
    thumbnail.src = videoInfo.thumbnail;
    thumbnail.style.display = "block";
  } else {
    thumbnail.style.display = "none";
  }

  title.textContent = videoInfo.title || "Twitter Video";
  author.textContent = videoInfo.uploader || "Unknown";
  duration.textContent = videoInfo.duration
    ? `${videoInfo.duration}s`
    : "Unknown duration";

  // Populate quality options
  const qualityList = modal.querySelector(".quality-list");
  const startDownloadBtn = modal.querySelector(".start-download");

  let selectedFormat = null;

  qualityList.innerHTML = "";

  videoInfo.formats.forEach((format, index) => {
    const qualityItem = document.createElement("div");
    qualityItem.className = "quality-item";
    qualityItem.dataset.formatId = format.format_id;

    qualityItem.innerHTML = `
      <div class="quality-main">
        <div class="quality-label">${formatQualityLabel(format)}</div>
        <div class="quality-details">
          ${format.ext?.toUpperCase() || "MP4"} • ${
      format.tbr ? format.tbr + " kbps" : "Unknown bitrate"
    }
        </div>
      </div>
      <div class="quality-size">${formatFileSize(format.filesize)}</div>
    `;

    qualityItem.addEventListener("click", () => {
      // Remove previous selection
      qualityList.querySelectorAll(".quality-item").forEach((item) => {
        item.classList.remove("selected");
      });

      // Select this item
      qualityItem.classList.add("selected");
      selectedFormat = format;
      startDownloadBtn.disabled = false;
    });

    qualityList.appendChild(qualityItem);

    // Auto-select first (highest quality) option
    if (index === 0) {
      qualityItem.click();
    }
  });

  // Handle download start
  startDownloadBtn.onclick = async () => {
    if (!selectedFormat) return;

    try {
      await startVideoDownload(modal, videoInfo, selectedFormat, videoUrl);
    } catch (error) {
      console.error("Download error:", error);
      showErrorInModal(modal, "Download failed. Please try again.");
    }
  };
}

async function startVideoDownload(modal, videoInfo, selectedFormat, videoUrl) {
  const qualitySelection = modal.querySelector(".quality-selection");
  const downloadProgress = modal.querySelector(".download-progress");

  // Show progress view
  qualitySelection.style.display = "none";
  downloadProgress.style.display = "block";

  try {
    // Check if we have a direct video URL
    if (selectedFormat.url) {
      // Use browser's built-in download via chrome.downloads API
      const response = await chrome.runtime.sendMessage({
        action: "downloadFile",
        url: selectedFormat.url,
        filename: generateVideoFilename(videoInfo, selectedFormat),
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      if (response.success) {
        showDownloadComplete(modal, videoInfo, selectedFormat, {
          filename: response.filename,
          downloadId: response.downloadId,
        });
      } else {
        throw new Error(response.message || "Failed to start download");
      }
    } else {
      // Fallback to server-side download (old method)
      const twitterUrl = videoUrl.replace("x.com", "twitter.com");
      const response = await chrome.runtime.sendMessage({
        action: "downloadVideo",
        videoUrl: twitterUrl,
        formatId: selectedFormat.format_id,
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      if (response.success && response.progress_id) {
        monitorDownloadProgress(
          modal,
          response.progress_id,
          videoInfo,
          selectedFormat
        );
      } else {
        throw new Error(response.message || "Failed to start download");
      }
    }
  } catch (error) {
    console.error("Download start error:", error);
    showErrorInModal(modal, error.message || "Failed to start download");
  }
}

function generateVideoFilename(videoInfo, selectedFormat) {
  // Clean the title for use as filename
  const cleanTitle = (videoInfo.title || "twitter_video")
    .replace(/[<>:"/\\|?*]/g, "_") // Replace invalid characters
    .substring(0, 100); // Limit length

  const resolution = selectedFormat.resolution || "unknown";
  const ext = selectedFormat.ext || "mp4";

  return `${cleanTitle}_${resolution}.${ext}`;
}

async function monitorDownloadProgress(
  modal,
  progressId,
  videoInfo,
  selectedFormat
) {
  const progressFill = modal.querySelector(".progress-fill");
  const progressPercent = modal.querySelector(".progress-percent");
  const progressSpeed = modal.querySelector(".progress-speed");
  const progressEta = modal.querySelector(".progress-eta");

  const checkProgress = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getDownloadProgress",
        progressId: progressId,
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      // Update progress UI
      const percent = response.percent || "0%";
      const numericPercent = parseInt(percent.replace("%", ""));

      progressFill.style.width = percent;
      progressPercent.textContent = percent;
      progressSpeed.textContent = response.speed || "";
      progressEta.textContent = response.eta || "";

      // Check status
      if (response.status === "completed" || response.status === "finished") {
        showDownloadComplete(modal, videoInfo, selectedFormat, response.result);
      } else if (response.status === "error") {
        showErrorInModal(modal, response.message || "Download failed");
      } else {
        // Continue monitoring
        setTimeout(checkProgress, 1000);
      }
    } catch (error) {
      console.error("Progress monitoring error:", error);
      showErrorInModal(modal, "Failed to monitor download progress");
    }
  };

  // Start monitoring
  checkProgress();
}

function showDownloadComplete(
  modal,
  videoInfo,
  selectedFormat,
  downloadResult
) {
  const downloadProgress = modal.querySelector(".download-progress");
  const downloadComplete = modal.querySelector(".download-complete");
  const downloadedFilename = modal.querySelector(".downloaded-filename");
  const downloadFileBtn = modal.querySelector(".download-file-btn");

  downloadProgress.style.display = "none";
  downloadComplete.style.display = "block";

  const filename =
    downloadResult?.filename ||
    `${videoInfo.title || "twitter_video"}.${selectedFormat.ext || "mp4"}`;
  downloadedFilename.textContent = filename;

  downloadFileBtn.onclick = () => {
    if (downloadResult?.filepath) {
      // Create download link for the actual file
      const downloadUrl = `${
        VIDEO_DOWNLOAD_SERVICE_URL || "http://localhost:8080"
      }/download_file/${encodeURIComponent(filename)}`;

      // Open download in new tab
      window.open(downloadUrl, "_blank");
      showContentScriptToast("Download started!", "success", 3000);
    } else {
      showContentScriptToast("Download file not available", "error", 3000);
    }
  };
}

function showErrorInModal(modal, errorMessage) {
  const loadingState = modal.querySelector(".loading-state");
  const qualitySelection = modal.querySelector(".quality-selection");
  const downloadProgress = modal.querySelector(".download-progress");
  const errorState = modal.querySelector(".error-state");
  const errorMessageEl = modal.querySelector(".error-message");
  const retryBtn = modal.querySelector(".retry-download");

  // Hide all other states
  loadingState.style.display = "none";
  qualitySelection.style.display = "none";
  downloadProgress.style.display = "none";

  // Show error state
  errorState.style.display = "block";
  errorMessageEl.textContent = errorMessage;

  retryBtn.onclick = () => {
    modal.style.display = "none";
    document.body.removeChild(modal);
  };
}
