// UI and DOM manipulation functions for MagicTweetExtension

function themeTonePanelDOM(panel, isDark) {
  if (!panel) return;
  panel.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
  panel.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
  panel.style.color = isDark ? "#FFFFFF" : "#14171A";

  const buttons = panel.querySelectorAll(`.${TONE_BUTTON_CLASS}`);
  buttons.forEach((button) => {
    button.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
    button.style.borderColor = "#1DA1F2";
    button.style.color = "#1DA1F2";
  });

  const header = panel.querySelector(`.${HEADER_CLASS}`);
  if (header) {
    header.style.borderBottomColor = isDark ? "#38444D" : "#E1E8ED";
  }
}

function themeSuggestionPanelDOM(panel, isDark) {
  if (!panel) return;
  panel.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
  panel.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
  panel.style.color = isDark ? "#FFFFFF" : "#14171A";

  const suggestions = panel.querySelectorAll(`.${SUGGESTION_CLASS}`);
  suggestions.forEach((suggestion) => {
    suggestion.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
    suggestion.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
    suggestion.style.color = isDark ? "#FFFFFF" : "#14171A";
  });

  const variations = panel.querySelectorAll(`.${VARIATION_CLASS}`);
  variations.forEach((variation) => {
    variation.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
    variation.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
  });

  const textsAndToneHeaders = panel.querySelectorAll(
    `.${TEXT_CLASS}, .${TONE_TEXT_CLASS}`
  );
  textsAndToneHeaders.forEach((textEl) => {
    textEl.style.color = isDark ? "#FFFFFF" : "#14171A";
  });

  const panelHeader = panel.querySelector(`.${HEADER_CLASS}`);
  if (panelHeader) {
    panelHeader.style.borderBottomColor = isDark ? "#38444D" : "#E1E8ED";
    const headerSpan = panelHeader.querySelector("span");
    if (headerSpan) headerSpan.style.color = isDark ? "#FFFFFF" : "#14171A";
  }

  const closeButton = panel.querySelector(`.${CLOSE_BUTTON_CLASS}`);
  if (closeButton) {
    closeButton.style.color = isDark ? "#FFFFFF" : "#14171A";
  }
}

function themeNewlyAddedSuggestions(container, isDark) {
  const suggestions = container.querySelectorAll(`.${SUGGESTION_CLASS}`);
  suggestions.forEach((suggestion) => {
    suggestion.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
    suggestion.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
    suggestion.style.color = isDark ? "#FFFFFF" : "#14171A";
  });

  const variations = container.querySelectorAll(`.${VARIATION_CLASS}`);
  variations.forEach((variation) => {
    variation.style.backgroundColor = isDark ? "#15202B" : "#FFFFFF";
    variation.style.borderColor = isDark ? "#38444D" : "#E1E8ED";
  });

  const texts = container.querySelectorAll(
    `.${TEXT_CLASS}, .${TONE_TEXT_CLASS}`
  );
  texts.forEach((text) => {
    text.style.color = isDark ? "#FFFFFF" : "#14171A";
  });
}

function applyGlobalThemeStyles(isDark) {
  window.MagicTweetExtension.currentThemeIsDark = isDark;
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light"
  );

  const suggestionPanel = document.getElementById(SUGGESTION_PANEL_ID);
  if (suggestionPanel) {
    themeSuggestionPanelDOM(suggestionPanel, isDark);
  }

  const tonePanel = document.getElementById(TONE_PANEL_ID);
  if (tonePanel) {
    themeTonePanelDOM(tonePanel, isDark);
  }
}

function createVideoDownloadIcon() {
  try {
    const icon = document.createElement("div");
    icon.id = VIDEO_DOWNLOAD_ICON_ID;
    icon.className = VIDEO_DOWNLOAD_ICON_ID;

    // Get custom download icon URL with error handling for context invalidation
    let iconUrl;
    try {
      iconUrl = chrome.runtime.getURL("icons/downloadIconMagicTweet.png");
    } catch (contextError) {
      console.warn("Extension context invalidated, using fallback icon");
      // Use a simple SVG icon as fallback when extension context is lost
      const svgContent =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      iconUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;
    }

    // Create download icon with proper styling
    icon.innerHTML = `<img src="${iconUrl}" alt="Download" style="width: 24px; height: 24px;">`;

    // Apply base styles with glass morphism effect
    Object.assign(icon.style, {
      backgroundColor: "rgba(255, 255, 255, 0.4)",
      borderRadius: "50%",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      position: "absolute",
      top: "10px",
      right: "10px",
      zIndex: "999999",
      width: "32px",
      height: "32px",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      backdropFilter: "blur(10px)",
    });

    // Add drop shadow to icon image
    const img = icon.querySelector("img");
    if (img) {
      img.style.filter = "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3))";
    }

    // Add hover effects: scale up and become more solid
    icon.addEventListener("mouseover", () => {
      icon.style.transform = "scale(1.15)";
      icon.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    });

    icon.addEventListener("mouseout", () => {
      icon.style.transform = "scale(1)";
      icon.style.backgroundColor = "rgba(255, 255, 255, 0.4)";
    });

    return icon;
  } catch (error) {
    console.error("Error creating video download icon:", error);
    if (typeof handleExtensionError === "function") handleExtensionError(error);
    return null;
  }
}

function createFloatingIcon() {
  try {
    const icon = document.createElement("div");
    icon.id = ICON_ID;
    icon.className = ICON_ID;

    let iconUrl;
    try {
      // Use icon128.png as the icon
      iconUrl = chrome.runtime.getURL("icons/icon128.png");
    } catch (e) {
      console.warn(
        "Extension context invalidated for floating icon, using fallback"
      );
      // Use a simple SVG icon as fallback when extension context is lost
      const svgContent =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
      iconUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;
    }

    // Adjust image style to fit within the button
    icon.innerHTML = `<img src="${iconUrl}" alt="${getLocalizedString(
      "extensionName"
    )}" style="width: 24px; height: 24px; border-radius: 4px;">`;

    Object.assign(icon.style, {
      backgroundColor: "transparent",
      color: "#FFFFFF",
      borderRadius: "50%",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      position: "fixed",
      right: "calc(50% - 250px)",
      top: "12%",
      zIndex: "999999",
      width: "32px",
      height: "32px",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid transparent",
    });

    icon.addEventListener("mouseover", () => {
      icon.style.transform = "translateY(-3px) scale(1.08)";
      icon.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.15)";
      icon.style.borderColor = "var(--primary-color)";
    });

    icon.addEventListener("mouseout", () => {
      icon.style.transform = "translateY(0) scale(1)";
      icon.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
      icon.style.borderColor = "transparent";
    });

    return icon;
  } catch (error) {
    // If getLocalizedString is not available here yet, handleExtensionError might also fail.
    // Consider passing a fallback error handler or ensuring this file is loaded after localization utils.
    // For now, assume handleExtensionError is available or this function doesn't error often before full init.
    console.error("Error creating floating icon:", error);
    if (typeof handleExtensionError === "function") handleExtensionError(error);
    return null;
  }
}

function createBasePanel(
  id,
  panelClassName,
  headerTextKey,
  initialContentSetupCallback,
  options = {}
) {
  const panel = document.createElement("div");
  panel.id = id;
  panel.className = panelClassName;

  Object.assign(panel.style, {
    display: "none",
    position: "fixed",
    right: "38%",
    top: "calc(14% + 50px)",
    width: "300px",
    zIndex: "10000",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    border: "1px solid #E1E8ED",
    padding: "12px",
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = HEADER_CLASS;
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #E1E8ED;
  `;

  let headerHTML = "";
  if (options.addBackButton) {
    const BACK_ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    headerHTML += `<button class="magic-tweet-header-back-button" style="background: none; border: none; font-size: 16px; cursor: pointer; color: inherit; margin-right: 10px; padding: 0; line-height: 0;">${BACK_ARROW_SVG}</button>`;
  }
  headerHTML += `<span style="font-weight: 500; flex-grow: 1;">${getLocalizedString(
    headerTextKey
  )}</span>`;
  headerHTML += `<button class="${CLOSE_BUTTON_CLASS}" style="background: none; border: none; font-size: 20px; cursor: pointer; color: inherit; padding: 0; line-height: 0;">×</button>`;
  header.innerHTML = headerHTML;

  const content = document.createElement("div");
  content.className = SUGGESTIONS_CLASS;
  content.style.cssText = `
    max-height: 400px;
    overflow-y: auto;
    padding-right: 4px;
  `;

  if (
    initialContentSetupCallback &&
    typeof initialContentSetupCallback === "function"
  ) {
    initialContentSetupCallback(content);
  }

  panel.appendChild(header);
  panel.appendChild(content);

  header
    .querySelector(`.${CLOSE_BUTTON_CLASS}`)
    .addEventListener("click", () => {
      panel.style.display = "none";
    });

  return { panel, contentDiv: content, headerElement: header };
}

function createSuggestionPanel() {
  const { panel, contentDiv, headerElement } = createBasePanel(
    SUGGESTION_PANEL_ID,
    CONTAINER_CLASS,
    "suggestionPanelHeader",
    null,
    { addBackButton: true }
  );

  themeSuggestionPanelDOM(panel, window.MagicTweetExtension.currentThemeIsDark);
  return panel;
}

function createToneSelectionPanel() {
  const { panel, contentDiv } = createBasePanel(
    TONE_PANEL_ID,
    CONTAINER_CLASS,
    "toneSelectionPanelHeader",
    (contentContainer) => {
      // Define tone icons mapping with inline SVG
      const TONE_ICONS = {
        styleSarcastic: "😏",
        tonePlayfulFunny: "😂",
        toneRomanticSoft: "❤️",
        toneMelancholicPoetic: "✍️",
        toneHopefulUplifting: "✨",
        toneCynicalDarkHumor: "😒",
        toneOverdramaticTheatrical: "🎭",
        toneMinimalistDry: "😐",
        toneInspirationalMotivational: "🚀",
        styleRoast: "🔥",
      };

      let toneButtonsHtml = '<div class="magic-tweet-tone-grid">';

      for (const internalKey in API_TONE_MESSAGE_KEYS) {
        const messageKey = API_TONE_MESSAGE_KEYS[internalKey];
        const localizedText = getLocalizedString(messageKey);
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
      contentContainer.innerHTML = toneButtonsHtml;

      // Remove default padding from content container for proper grid fit
      contentContainer.style.padding = "12px";
      contentContainer.style.paddingRight = "12px";

      // Add CSS styles
      const style = document.createElement("style");
      style.textContent = `
        :root {
          --primary-color: #1DA1F2;
        }
        
        :root[data-theme="light"] {
          --background-color: #FFFFFF;
          --text-color: #14171A;
          --border-color: #E1E8ED;
        }

        :root[data-theme="dark"] {
          --background-color: #15202B;
          --text-color: #FFFFFF;
          --border-color: #38444D;
        }

        .magic-tweet-tone-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          width: 100%;
          gap: 12px;
          padding: 0;
          margin: 0;
        }
        
        .magic-tweet-tone-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 8px;
          background: var(--background-color);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          min-height: 70px;
          user-select: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
          position: relative;
          overflow: hidden;
        }
        
        .magic-tweet-tone-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--primary-color);
          opacity: 0;
          transition: opacity 0.2s ease;
          border-radius: 12px;
        }
        
        .magic-tweet-tone-item:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.08);
          border-color: var(--primary-color);
        }
        
        .magic-tweet-tone-item:hover::before {
          opacity: 0.04;
        }
        
        .magic-tweet-tone-item:active {
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1), 0 2px 5px rgba(0, 0, 0, 0.06);
          transition: all 0.1s ease;
        }
        
        .magic-tweet-tone-icon {
          width: 36px;
          height: 36px;
          background: var(--background-color);
          border: 1px solid var(--border-color);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          z-index: 1;
        }
        
        .magic-tweet-tone-item:hover .magic-tweet-tone-icon {
          transform: scale(1.08);
          border-color: var(--primary-color);
          box-shadow: 0 4px 12px rgba(29, 161, 242, 0.2), 0 2px 4px rgba(29, 161, 242, 0.1);
        }
        
        .magic-tweet-tone-icon svg {
          width: 18px;
          height: 18px;
        }
        
        .magic-tweet-tone-label {
          font-size: 11px;
          font-weight: 500;
          text-align: center;
          color: var(--text-color);
          line-height: 1.2;
          position: relative;
          z-index: 1;
          opacity: 0.8;
          transition: all 0.2s ease;
        }
        
        .magic-tweet-tone-item:hover .magic-tweet-tone-label {
          color: var(--primary-color);
          font-weight: 600;
          opacity: 1;
        }
        
        /* Dark theme support */
        [data-theme="dark"] .magic-tweet-tone-item {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15);
        }
        
        [data-theme="dark"] .magic-tweet-tone-item:hover {
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35), 0 4px 10px rgba(0, 0, 0, 0.25);
        }
        
        [data-theme="dark"] .magic-tweet-tone-item:active {
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 2px 5px rgba(0, 0, 0, 0.2);
        }
        
        /* Responsive design */
        @media (max-width: 400px) {
          .magic-tweet-tone-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            padding: 0;
          }
          
          .magic-tweet-tone-item {
            padding: 10px 6px;
            min-height: 60px;
            border-radius: 10px;
          }
          
          .magic-tweet-tone-icon {
            width: 32px;
            height: 32px;
          }
          
          .magic-tweet-tone-icon svg {
            width: 16px;
            height: 16px;
          }
          
          .magic-tweet-tone-label {
            font-size: 10px;
          }
        }
      `;

      if (!document.getElementById("magic-tweet-tone-styles")) {
        style.id = "magic-tweet-tone-styles";
        document.head.appendChild(style);
      }
    }
  );

  addToneButtonListeners(panel);
  themeTonePanelDOM(panel, window.MagicTweetExtension.currentThemeIsDark);
  return panel;
}

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
        width: 8px;
        height: 8px;
        background-color: var(--primary-color, #1DA1F2);
        border-radius: 50%;
        margin: 0 4px;
        animation: bounce 1s infinite ease-in-out both;
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
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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

function displaySuggestions(suggestions, container) {
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

  container.innerHTML = "";

  if (!suggestions) {
    container.innerHTML = `<div class="${ERROR_CLASS}" style="color: #E0245E;">${getLocalizedString(
      "errorNoSuggestionsAvailable"
    )}</div>`;
    return;
  }

  try {
    let suggestionsToDisplay = [];

    if (typeof suggestions === "string") {
      suggestionsToDisplay = [
        {
          tone: getLocalizedString("defaultSuggestionTone"),
          variations: [suggestions],
        },
      ];
    } else if (Array.isArray(suggestions)) {
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
      if (suggestions.variations) {
        suggestionsToDisplay = [suggestions];
      } else {
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
        .filter((text) => text)
        .map((text, index) => {
          const isRTL = document.documentElement.dir === "rtl";
          const buttonFloatStyle = `
              float: ${isRTL ? "left" : "right"};
              margin-${isRTL ? "right" : "left"}: 4px;
              margin-top: 2px;
            `;

          return `
          <div class="${VARIATION_CLASS}" style="
            overflow: hidden;
            margin-bottom: 8px;
            padding: 8px;
            background: #FFFFFF;
            border: 1px solid #E1E8ED;
            border-radius: 6px;
            color: #14171A;
          ">
            <div class="${TEXT_CLASS}" style="
              color: #14171A;
            ">${text}</div>
            <button class="${COPY_BUTTON_CLASS}" style="
              ${buttonFloatStyle}
              background: #1DA1F2;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 16px;
              cursor: pointer;
              transition: background 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
            " data-variation="${index}">
              ${COPY_ICON_SVG} 
            </button>
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
              button.innerHTML = SUCCESS_ICON_SVG;
              button.style.backgroundColor = "#17BF63";

              setTimeout(() => {
                button.innerHTML = COPY_ICON_SVG;
                button.style.backgroundColor = "#1DA1F2";
              }, 2000);
            } catch (err) {
              console.error("Failed to copy text:", err);
              button.innerHTML = ERROR_ICON_SVG;
              button.style.backgroundColor = "#E0245E";

              setTimeout(() => {
                button.innerHTML = COPY_ICON_SVG;
                button.style.backgroundColor = "#1DA1F2";
              }, 2000);
            }
          });

          button.addEventListener("mouseover", () => {
            if (button.style.backgroundColor === "rgb(29, 161, 242)") {
              button.style.backgroundColor = "#1a91da";
            }
          });
          button.addEventListener("mouseout", () => {
            const currentIconHTML = button.innerHTML.trim();
            if (currentIconHTML === COPY_ICON_SVG.trim()) {
              button.style.backgroundColor = "#1DA1F2";
            } else if (currentIconHTML === SUCCESS_ICON_SVG.trim()) {
              button.style.backgroundColor = "#17BF63";
            } else if (currentIconHTML === ERROR_ICON_SVG.trim()) {
              button.style.backgroundColor = "#E0245E";
            }
          });
        });

      container.appendChild(suggestionDiv);
    });

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

function createVideoDownloadModal() {
  const modal = document.createElement("div");
  modal.id = VIDEO_DOWNLOAD_MODAL_ID;
  modal.className = `${EXT_NAMESPACE}-download-modal`;

  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Download Video</h3>
          <button class="close-modal">×</button>
        </div>
        <div class="modal-body">
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Analyzing video qualities...</p>
          </div>
          <div class="quality-selection" style="display: none;">
            <div class="video-info">
              <img class="video-thumbnail" src="" alt="Video thumbnail">
              <div class="video-details">
                <h4 class="video-title"></h4>
                <p class="video-author"></p>
                <p class="video-duration"></p>
              </div>
            </div>
            <div class="quality-options">
              <h4>Select Quality:</h4>
              <div class="quality-list"></div>
            </div>
            <div class="download-actions">
              <button class="cancel-download">Cancel</button>
              <button class="start-download" disabled>Download</button>
            </div>
          </div>
          <div class="download-progress" style="display: none;">
            <div class="progress-info">
              <h4>Downloading...</h4>
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
              <div class="progress-details">
                <span class="progress-percent">0%</span>
                <span class="progress-speed"></span>
                <span class="progress-eta"></span>
              </div>
            </div>
          </div>
          <div class="download-complete" style="display: none;">
            <div class="success-icon">✅</div>
            <h4>Download Complete!</h4>
            <p class="downloaded-filename"></p>
            <button class="download-file-btn">Download File</button>
          </div>
          <div class="error-state" style="display: none;">
            <div class="error-icon">❌</div>
            <h4>Download Failed</h4>
            <p class="error-message"></p>
            <button class="retry-download">Try Again</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Apply styles
  Object.assign(modal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "999999",
    display: "none",
  });

  // Add CSS styles
  const style = document.createElement("style");
  style.textContent = `
    .${EXT_NAMESPACE}-download-modal .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    }

    .${EXT_NAMESPACE}-download-modal .modal-content {
      background: var(--background-color, #ffffff);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }

    .${EXT_NAMESPACE}-download-modal .modal-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--border-color, #e1e8ed);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .${EXT_NAMESPACE}-download-modal .modal-header h3 {
      margin: 0;
      color: var(--text-color, #14171a);
      font-size: 18px;
      font-weight: 600;
    }

    .${EXT_NAMESPACE}-download-modal .close-modal {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--text-color, #14171a);
      padding: 4px;
      border-radius: 50%;
      transition: background 0.2s;
    }

    .${EXT_NAMESPACE}-download-modal .close-modal:hover {
      background: var(--hover-bg, #f7f9fa);
    }

    .${EXT_NAMESPACE}-download-modal .modal-body {
      padding: 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .${EXT_NAMESPACE}-download-modal .loading-state {
      text-align: center;
      padding: 40px 20px;
    }

    .${EXT_NAMESPACE}-download-modal .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color, #e1e8ed);
      border-top: 3px solid var(--primary-color, #1da1f2);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    .${EXT_NAMESPACE}-download-modal .video-info {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      padding: 16px;
      background: var(--secondary-bg, #f7f9fa);
      border-radius: 12px;
    }

    .${EXT_NAMESPACE}-download-modal .video-thumbnail {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .${EXT_NAMESPACE}-download-modal .video-details h4 {
      margin: 0 0 8px 0;
      color: var(--text-color, #14171a);
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
    }

    .${EXT_NAMESPACE}-download-modal .video-details p {
      margin: 4px 0;
      color: var(--secondary-text, #657786);
      font-size: 14px;
    }

    .${EXT_NAMESPACE}-download-modal .quality-options h4 {
      margin: 0 0 16px 0;
      color: var(--text-color, #14171a);
      font-size: 16px;
      font-weight: 600;
    }

    .${EXT_NAMESPACE}-download-modal .quality-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border: 2px solid var(--border-color, #e1e8ed);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .${EXT_NAMESPACE}-download-modal .quality-item:hover {
      border-color: var(--primary-color, #1da1f2);
      background: var(--hover-bg, #f7f9fa);
    }

    .${EXT_NAMESPACE}-download-modal .quality-item.selected {
      border-color: var(--primary-color, #1da1f2);
      background: rgba(29, 161, 242, 0.1);
    }

    .${EXT_NAMESPACE}-download-modal .quality-main {
      display: flex;
      flex-direction: column;
    }

    .${EXT_NAMESPACE}-download-modal .quality-label {
      font-weight: 600;
      color: var(--text-color, #14171a);
      margin-bottom: 4px;
    }

    .${EXT_NAMESPACE}-download-modal .quality-details {
      font-size: 12px;
      color: var(--secondary-text, #657786);
    }

    .${EXT_NAMESPACE}-download-modal .quality-size {
      font-size: 12px;
      color: var(--secondary-text, #657786);
      font-weight: 500;
    }

    .${EXT_NAMESPACE}-download-modal .download-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color, #e1e8ed);
    }

    .${EXT_NAMESPACE}-download-modal .download-actions button {
      padding: 10px 20px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .${EXT_NAMESPACE}-download-modal .cancel-download {
      background: var(--secondary-bg, #f7f9fa);
      color: var(--text-color, #14171a);
    }

    .${EXT_NAMESPACE}-download-modal .cancel-download:hover {
      background: var(--border-color, #e1e8ed);
    }

    .${EXT_NAMESPACE}-download-modal .start-download {
      background: var(--primary-color, #1da1f2);
      color: white;
    }

    .${EXT_NAMESPACE}-download-modal .start-download:hover:not(:disabled) {
      background: #1991db;
    }

    .${EXT_NAMESPACE}-download-modal .start-download:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .${EXT_NAMESPACE}-download-modal .progress-bar {
      width: 100%;
      height: 8px;
      background: var(--border-color, #e1e8ed);
      border-radius: 4px;
      overflow: hidden;
      margin: 16px 0;
    }

    .${EXT_NAMESPACE}-download-modal .progress-fill {
      height: 100%;
      background: var(--primary-color, #1da1f2);
      transition: width 0.3s ease;
      width: 0%;
    }

    .${EXT_NAMESPACE}-download-modal .progress-details {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: var(--secondary-text, #657786);
    }

    .${EXT_NAMESPACE}-download-modal .download-complete,
    .${EXT_NAMESPACE}-download-modal .error-state {
      text-align: center;
      padding: 40px 20px;
    }

    .${EXT_NAMESPACE}-download-modal .success-icon,
    .${EXT_NAMESPACE}-download-modal .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .${EXT_NAMESPACE}-download-modal .download-file-btn,
    .${EXT_NAMESPACE}-download-modal .retry-download {
      background: var(--primary-color, #1da1f2);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 20px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 16px;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  if (!document.getElementById(`${EXT_NAMESPACE}-download-modal-styles`)) {
    style.id = `${EXT_NAMESPACE}-download-modal-styles`;
    document.head.appendChild(style);
  }

  // Add event listeners
  const closeModal = modal.querySelector(".close-modal");
  const cancelDownload = modal.querySelector(".cancel-download");
  const modalOverlay = modal.querySelector(".modal-overlay");

  const closeModalHandler = () => {
    modal.style.display = "none";
    document.body.removeChild(modal);
  };

  closeModal.addEventListener("click", closeModalHandler);
  cancelDownload.addEventListener("click", closeModalHandler);

  // Close on overlay click (but not modal content)
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModalHandler();
    }
  });

  return modal;
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "Unknown size";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const formattedSize = Math.round((bytes / Math.pow(1024, i)) * 100) / 100;
  return formattedSize + " " + sizes[i];
}

function formatQualityLabel(format) {
  const resolution = format.resolution || `${format.width}x${format.height}`;
  const quality = format.quality || "Unknown";
  const fps = format.fps ? ` ${format.fps}fps` : "";

  return `${resolution}${fps} - ${quality}`;
}
