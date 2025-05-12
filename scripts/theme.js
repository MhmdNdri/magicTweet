// Theme management
const THEME_KEY = "magic-tweet-theme";

// Initialize theme when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const THEME_TOGGLE_BTN = document.getElementById("themeToggle");
  const THEME_ICON = THEME_TOGGLE_BTN.querySelector(".material-icons-round");

  // Initialize theme
  function initTheme() {
    chrome.storage.local.get([THEME_KEY], (result) => {
      const savedTheme = result[THEME_KEY] || "light";

      // Apply the theme
      setTheme(savedTheme);

      // Add smooth transition for theme changes
      document.documentElement.style.transition =
        "background-color 0.3s ease, color 0.3s ease";
    });
  }

  // Set theme
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    chrome.storage.local.set({ [THEME_KEY]: theme });

    // Update icon
    THEME_ICON.textContent = theme === "dark" ? "light_mode" : "dark_mode";
  }

  // Toggle theme with animation
  function toggleTheme() {
    // Add animation to the toggle button
    THEME_TOGGLE_BTN.classList.add("clicked");
    setTimeout(() => {
      THEME_TOGGLE_BTN.classList.remove("clicked");
    }, 300);

    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";

    // Add a subtle animation to the entire page
    document.body.style.opacity = "0.98";
    setTimeout(() => {
      document.body.style.opacity = "1";
    }, 150);

    setTheme(newTheme);
  }

  // Event listeners
  THEME_TOGGLE_BTN.addEventListener("click", toggleTheme);

  // Add CSS for the animations
  const style = document.createElement("style");
  style.textContent = `
    .theme-toggle.clicked {
      animation: pulse 0.3s ease;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    body {
      transition: opacity 0.15s ease;
    }
  `;
  document.head.appendChild(style);

  // Initialize theme
  initTheme();
});
