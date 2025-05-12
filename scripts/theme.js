// Theme management
const THEME_KEY = "magic-tweet-theme";
const THEME_TOGGLE_BTN = document.getElementById("themeToggle");

// Store SVG icons
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg icon-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg icon-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

// Initialize theme when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Ensure the button exists before proceeding
  if (!THEME_TOGGLE_BTN) {
    console.error("Theme toggle button not found!");
    return;
  }

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

    // Update icon inside the button
    if (THEME_TOGGLE_BTN) {
      THEME_TOGGLE_BTN.innerHTML = theme === "dark" ? sunIcon : moonIcon;
    }
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
