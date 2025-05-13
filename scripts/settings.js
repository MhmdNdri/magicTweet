document.addEventListener("DOMContentLoaded", () => {
  const aiProviderRadios = document.querySelectorAll(
    'input[name="aiProvider"]'
  );
  const AI_PROVIDER_KEY = "magic-tweet-ai-provider";

  // Load saved AI provider preference
  chrome.storage.local.get([AI_PROVIDER_KEY], (result) => {
    const savedProvider = result[AI_PROVIDER_KEY] || "openai"; // Default to openai
    aiProviderRadios.forEach((radio) => {
      if (radio.value === savedProvider) {
        radio.checked = true;
      }
    });
  });

  // Save AI provider preference on change
  aiProviderRadios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      if (event.target.checked) {
        chrome.storage.local.set(
          { [AI_PROVIDER_KEY]: event.target.value },
          () => {
            console.log("AI Provider preference saved:", event.target.value);
          }
        );
      }
    });
  });

  // Apply i18n to new elements
  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((elem) => {
      const key = elem.getAttribute("data-i18n");
      elem.textContent = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((elem) => {
      const key = elem.getAttribute("data-i18n-alt");
      elem.alt = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll("[data-i18n-label]").forEach((elem) => {
      const key = elem.getAttribute("data-i18n-label");
      elem.setAttribute("aria-label", chrome.i18n.getMessage(key));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((elem) => {
      const key = elem.getAttribute("data-i18n-placeholder");
      elem.placeholder = chrome.i18n.getMessage(key);
    });
  }

  // Check if i18n API is available (it should be in an extension popup)
  if (chrome.i18n && chrome.i18n.getMessage) {
    applyTranslations();
  } else {
    console.warn(
      "chrome.i18n API not available for settings.js in this context."
    );
  }
});
