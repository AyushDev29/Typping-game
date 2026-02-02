/**
 * Scoring Module - MonkeyType Style
 * 
 * Calculates typing metrics using MonkeyType methodology:
 * - Raw WPM: All typed characters / 5 / minutes
 * - Net WPM: (Correct characters - Incorrect characters) / 5 / minutes  
 * - Accuracy: Correct characters / Total characters typed × 100
 * - Final Score: Net WPM (primary metric for ranking)
 */

/**
 * Calculate typing metrics using MonkeyType methodology
 * @param {string} originalText - The paragraph to type
 * @param {string} typedText - What the user typed
 * @param {number} timeInSeconds - Time taken in seconds
 * @returns {Object} - Object containing accuracy, wpm, and finalScore
 */
export function calculateScore(originalText, typedText, timeInSeconds) {
  // Validate inputs
  if (!originalText || typeof originalText !== 'string') {
    return {
      correctChars: 0,
      incorrectChars: 0,
      totalCharsTyped: 0,
      totalCharsExpected: 0,
      accuracy: 0,
      rawWpm: 0,
      netWpm: 0,
      wpm: 0, // Net WPM (for compatibility)
      finalScore: 0
    };
  }
  
  if (typeof typedText !== 'string') {
    typedText = '';
  }
  
  if (!timeInSeconds || timeInSeconds <= 0 || !isFinite(timeInSeconds)) {
    timeInSeconds = 1; // Default to 1 second to avoid division by zero
  }
  
  // Normalize the original text (preserve exact spacing and punctuation)
  const original = originalText.trim();
  const typed = typedText;
  
  // Handle empty original text
  if (original.length === 0) {
    return {
      correctChars: 0,
      incorrectChars: 0,
      totalCharsTyped: 0,
      totalCharsExpected: 0,
      accuracy: 0,
      rawWpm: 0,
      netWpm: 0,
      wpm: 0,
      finalScore: 0
    };
  }
  
  // Character-by-character comparison (MonkeyType style)
  let correctChars = 0;
  let incorrectChars = 0;
  const totalCharsTyped = typed.length;
  const totalCharsExpected = original.length;
  
  // Compare each character position
  const minLength = Math.min(original.length, typed.length);
  
  for (let i = 0; i < minLength; i++) {
    if (original[i] === typed[i]) {
      correctChars++;
    } else {
      incorrectChars++;
    }
  }
  
  // Handle extra characters typed (all count as incorrect)
  if (typed.length > original.length) {
    incorrectChars += (typed.length - original.length);
  }
  
  // Handle missing characters (count as incorrect for accuracy calculation)
  if (original.length > typed.length) {
    incorrectChars += (original.length - typed.length);
  }
  
  // Calculate accuracy: correct chars / total chars that should have been typed
  const accuracy = totalCharsExpected > 0 ? (correctChars / totalCharsExpected) * 100 : 0;
  
  // Calculate WPM using MonkeyType methodology
  const timeInMinutes = timeInSeconds / 60;
  
  // Raw WPM: All characters typed / 5 / minutes
  const rawWpm = timeInMinutes > 0 ? (totalCharsTyped / 5) / timeInMinutes : 0;
  
  // Net WPM: (Correct chars - Incorrect chars) / 5 / minutes
  // This is the primary metric used for ranking
  const netWpm = timeInMinutes > 0 ? Math.max(0, (correctChars - incorrectChars) / 5) / timeInMinutes : 0;
  
  // Final Score = Net WPM (this is what MonkeyType uses for ranking)
  const finalScore = netWpm;
  
  // Ensure all values are valid numbers
  return {
    correctChars: Math.max(0, correctChars),
    incorrectChars: Math.max(0, incorrectChars),
    totalCharsTyped: Math.max(0, totalCharsTyped),
    totalCharsExpected: Math.max(0, totalCharsExpected),
    accuracy: Math.max(0, Math.min(100, Math.round(accuracy * 100) / 100)),
    rawWpm: Math.max(0, Math.round(rawWpm * 100) / 100),
    netWpm: Math.max(0, Math.round(netWpm * 100) / 100),
    wpm: Math.max(0, Math.round(netWpm * 100) / 100), // Use Net WPM as primary WPM
    finalScore: Math.max(0, Math.round(finalScore * 100) / 100)
  };
}

/**
 * Format time display (MM:SS)
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
