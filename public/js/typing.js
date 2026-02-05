/**
 * Blind Typing Module
 * 
 * Implements blind typing functionality:
 * - Captures keydown events
 * - Builds typed string in memory (NOT displayed)
 * - Disables copy, paste, selection, right-click
 * - No visible input field
 */

let typedText = '';
let startTime = null;
let isTyping = false;
let currentParagraph = '';
let keyDownHandler = null;
let eventListeners = [];

/**
 * Initialize blind typing
 * @param {string} paragraph - The paragraph to type
 * @param {Function} onComplete - Callback when typing is complete
 */
export function initBlindTyping(paragraph, onComplete) {
  typedText = '';
  startTime = null;
  isTyping = false;
  currentParagraph = paragraph;
  
  // Display the paragraph
  const paragraphElement = document.getElementById('paragraph-display');
  if (paragraphElement) {
    paragraphElement.textContent = paragraph;
  }
  
  // Set up event listeners
  setupTypingListeners(onComplete);
  
  // Disable all text manipulation
  disableTextManipulation();
}

/**
 * Set up keyboard event listeners for typing
 * @param {Function} onComplete - Callback when complete
 */
function setupTypingListeners(onComplete) {
  // Clean up existing listeners first
  if (keyDownHandler) {
    document.removeEventListener('keydown', keyDownHandler);
  }
  
  // Create new handler
  keyDownHandler = handleKeyDown;
  
  // Add keydown listener
  document.addEventListener('keydown', keyDownHandler);
  
  // Store onComplete callback
  window.typingOnComplete = onComplete;
}

/**
 * Handle keydown events
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyDown(event) {
  // Only capture if typing is active
  if (!isTyping) {
    // Start typing on first keypress
    if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Enter') {
      isTyping = true;
      startTime = Date.now();
    } else {
      return;
    }
  }
  
  // Prevent default for special keys
  if (event.ctrlKey || event.metaKey) {
    // Block Ctrl+C, Ctrl+V, Ctrl+A, etc.
    if (['c', 'v', 'a', 'x', 'z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      return;
    }
  }
  
  // Handle typing
  if (event.key === 'Backspace') {
    // Remove last character
    typedText = typedText.slice(0, -1);
  } else if (event.key === 'Enter') {
    // Add newline
    typedText += '\n';
  } else if (event.key.length === 1) {
    // Regular character
    typedText += event.key;
  }
  
  // Update character count display (without showing typed text)
  updateTypingStats();
}

/**
 * Update typing statistics display
 */
function updateTypingStats() {
  const statsElement = document.getElementById('typing-stats');
  if (statsElement) {
    statsElement.textContent = `Characters typed: ${typedText.length}`;
  }
}

// Store event handlers for cleanup
const textManipulationHandlers = {
  contextmenu: null,
  copy: null,
  paste: null,
  cut: null,
  selectstart: null,
  dragstart: null
};

/**
 * Disable all text manipulation features
 */
function disableTextManipulation() {
  // Clean up existing handlers first
  cleanupTextManipulation();
  
  // Create handlers
  textManipulationHandlers.contextmenu = (e) => {
    e.preventDefault();
    return false;
  };
  textManipulationHandlers.copy = (e) => {
    e.preventDefault();
    return false;
  };
  textManipulationHandlers.paste = (e) => {
    e.preventDefault();
    return false;
  };
  textManipulationHandlers.cut = (e) => {
    e.preventDefault();
    return false;
  };
  textManipulationHandlers.selectstart = (e) => {
    e.preventDefault();
    return false;
  };
  textManipulationHandlers.dragstart = (e) => {
    e.preventDefault();
    return false;
  };
  
  // Add event listeners
  document.addEventListener('contextmenu', textManipulationHandlers.contextmenu);
  document.addEventListener('copy', textManipulationHandlers.copy);
  document.addEventListener('paste', textManipulationHandlers.paste);
  document.addEventListener('cut', textManipulationHandlers.cut);
  document.addEventListener('selectstart', textManipulationHandlers.selectstart);
  document.addEventListener('dragstart', textManipulationHandlers.dragstart);
  
  // Make body unselectable via CSS
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  document.body.style.mozUserSelect = 'none';
  document.body.style.msUserSelect = 'none';
}

/**
 * Clean up text manipulation event listeners
 */
function cleanupTextManipulation() {
  if (textManipulationHandlers.contextmenu) {
    document.removeEventListener('contextmenu', textManipulationHandlers.contextmenu);
  }
  if (textManipulationHandlers.copy) {
    document.removeEventListener('copy', textManipulationHandlers.copy);
  }
  if (textManipulationHandlers.paste) {
    document.removeEventListener('paste', textManipulationHandlers.paste);
  }
  if (textManipulationHandlers.cut) {
    document.removeEventListener('cut', textManipulationHandlers.cut);
  }
  if (textManipulationHandlers.selectstart) {
    document.removeEventListener('selectstart', textManipulationHandlers.selectstart);
  }
  if (textManipulationHandlers.dragstart) {
    document.removeEventListener('dragstart', textManipulationHandlers.dragstart);
  }
  
  // Reset handlers
  Object.keys(textManipulationHandlers).forEach(key => {
    textManipulationHandlers[key] = null;
  });
}

/**
 * Get typed text
 * @returns {string} - The typed text
 */
export function getTypedText() {
  return typedText;
}

/**
 * Get elapsed time in seconds
 * @returns {number} - Time in seconds
 */
export function getElapsedTime() {
  if (!startTime) {
    // Fallback: if startTime is missing but user typed something, estimate reasonable time
    if (typedText.length > 0) {
      // Estimate ~3 characters per second (20 WPM baseline)
      return Math.max(1, typedText.length / 3);
    }
    return 0;
  }
  return (Date.now() - startTime) / 1000;
}

/**
 * Stop typing and clean up
 */
export function stopTyping() {
  isTyping = false;
  
  // Remove keydown listener
  if (keyDownHandler) {
    document.removeEventListener('keydown', keyDownHandler);
    keyDownHandler = null;
  }
  
  // Clean up text manipulation handlers
  cleanupTextManipulation();
  
  // Restore body styles
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
  document.body.style.mozUserSelect = '';
  document.body.style.msUserSelect = '';
}

/**
 * Reset typing state
 */
export function resetTyping() {
  typedText = '';
  startTime = null;
  isTyping = false;
  currentParagraph = '';
  stopTyping();
}
