document.addEventListener("DOMContentLoaded", () => {
  const languageToggleBtn = document.getElementById("languageToggle");
  const langKey = "userLanguage";
  let currentMessages = {};

  // Function to fetch messages for a specific language
  async function loadMessages(lang) {
    try {
      const response = await fetch(
        chrome.runtime.getURL(`_locales/${lang}/messages.json`)
      );
      if (!response.ok) {
        console.error(
          `Failed to load messages for ${lang}: ${response.statusText}`
        );
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Error loading messages for ${lang}:`, error);
      return null;
    }
  }

  // Function to apply translations
  function applyTranslations(lang, messages) {
    if (!messages) return;

    currentMessages = messages; // Store loaded messages
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";

    const currentLangTextElement = document.getElementById("currentLangText");
    if (currentLangTextElement) {
      currentLangTextElement.textContent = lang.toUpperCase();
    }

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (messages[key] && messages[key].message) {
        element.textContent = messages[key].message;
      }
    });

    // Handle attributes like aria-label, alt, title
    document.querySelectorAll("[data-i18n-label]").forEach((element) => {
      const key = element.getAttribute("data-i18n-label");
      if (messages[key] && messages[key].message) {
        element.setAttribute("aria-label", messages[key].message);
      }
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      const key = element.getAttribute("data-i18n-alt");
      if (messages[key] && messages[key].message) {
        element.setAttribute("alt", messages[key].message);
      }
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      const key = element.getAttribute("data-i18n-title");
      // Apply to title attribute or element text content (like <title> tag)
      if (messages[key] && messages[key].message) {
        if (element.tagName.toLowerCase() === "title") {
          element.textContent = messages[key].message;
        } else {
          element.setAttribute("title", messages[key].message);
        }
      }
    });

    // Specific fix for the <title> tag as it might not have data-i18n-title
    const pageTitle = document.querySelector("title[data-i18n]");
    if (pageTitle) {
      const key = pageTitle.getAttribute("data-i18n");
      if (messages[key] && messages[key].message) {
        pageTitle.textContent = messages[key].message;
      }
    }
  }

  // Function to set and load language
  async function setLanguage(lang) {
    const messages = await loadMessages(lang);
    if (messages) {
      applyTranslations(lang, messages);
      chrome.storage.local.set({ [langKey]: lang });
    } else {
      // Fallback or error handling if messages fail to load
      console.warn(
        `Could not load messages for ${lang}, keeping previous language.`
      );
    }
  }

  // Event listener for the toggle button
  languageToggleBtn.addEventListener("click", () => {
    chrome.storage.local.get([langKey], (result) => {
      const currentLang = result[langKey] || "en"; // Default to English
      const nextLang = currentLang === "en" ? "fa" : "en";
      setLanguage(nextLang);
    });
  });

  // Initial load
  chrome.storage.local.get([langKey], (result) => {
    const initialLang = result[langKey] || "en"; // Default to English if not set
    setLanguage(initialLang);
  });
});
