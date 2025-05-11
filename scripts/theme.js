// Theme management
const THEME_KEY = "magic-tweet-theme";

// Initialize theme when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const THEME_TOGGLE_BTN = document.getElementById("themeToggle");
  const THEME_ICON = THEME_TOGGLE_BTN.querySelector(".material-icons");

  // Initialize theme
  function initTheme() {
    chrome.storage.local.get([THEME_KEY], (result) => {
      const savedTheme = result[THEME_KEY] || "light";
      setTheme(savedTheme);
    });
  }

  // Set theme
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    chrome.storage.local.set({ [THEME_KEY]: theme });

    // Update icon
    THEME_ICON.textContent = theme === "dark" ? "light_mode" : "dark_mode";
  }

  // Toggle theme
  function toggleTheme() {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  }

  // Event listeners
  THEME_TOGGLE_BTN.addEventListener("click", toggleTheme);

  // Initialize theme
  initTheme();
});
