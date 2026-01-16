/**
 * Scoring Module
 * 
 * Calculates typing metrics:
 * - Accuracy: (CorrectChars / TotalChars) × 100
 * - WPM: (CorrectChars / 5) / Minutes
 * - Final Score: WPM × (Accuracy / 100)
 */

/**
 * Calculate typing metrics - WORD-BY-WORD ACCURACY (SPEC COMPLIANT)
 * @param {string} originalText - The paragraph to type
 * @param {string} typedText - What the user typed
 * @param {number} timeInSeconds - Time taken in seconds
 * @returns {Object} - Object containing accuracy, wpm, and finalScore
 */
export function calculateScore(originalText, typedText, timeInSeconds) {
  // Validate inputs
  if (!originalText || typeof originalText !== 'string') {
    return {
      correctWords: 0,
      totalWords: 0,
      correctChars: 0,
      totalChars: 0,
      accuracy: 0,
      wpm: 0,
      finalScore: 0
    };
  }
  
  if (typeof typedText !== 'string') {
    typedText = '';
  }
  
  if (!timeInSeconds || timeInSeconds <= 0 || !isFinite(timeInSeconds)) {
    timeInSeconds = 1; // Default to 1 second to avoid division by zero
  }
  
  // Normalize whitespace and trim
  const original = originalText.trim().replace(/\s+/g, ' ');
  const typed = typedText.trim().replace(/\s+/g, ' ');
  
  // Handle empty original text
  if (original.length === 0) {
    return {
      correctWords: 0,
      totalWords: 0,
      correctChars: 0,
      totalChars: 0,
      accuracy: 0,
      wpm: 0,
      finalScore: 0
    };
  }
  
  // CRITICAL: Split into words for word-by-word comparison
  const originalWords = original.split(' ');
  const typedWords = typed.split(' ');
  
  const totalWords = originalWords.length;
  let correctWords = 0;
  let correctChars = 0;
  
  // Compare word by word at each position
  for (let i = 0; i < totalWords; i++) {
    const originalWord = originalWords[i];
    const typedWord = typedWords[i] || ''; // Empty string if user didn't type this word
    
    // Word must match EXACTLY to be counted as correct
    if (originalWord === typedWord) {
      correctWords++;
      // Count characters from correct words only
      correctChars += originalWord.length;
    }
    // Missing words or wrong words = 0 credit
  }
  
  // Calculate WORD-BASED accuracy
  // Accuracy = (Correct Words / Total Words) × 100
  const accuracy = totalWords > 0 ? (correctWords / totalWords) * 100 : 0;
  
  // Calculate WPM using correct characters from correct words
  // WPM = (Correct Characters / 5) / Minutes
  const timeInMinutes = timeInSeconds / 60;
  const wpm = timeInMinutes > 0 ? (correctChars / 5) / timeInMinutes : 0;
  
  // Calculate Final Score
  // Final Score = WPM × (Accuracy / 100)
  const finalScore = wpm * (accuracy / 100);
  
  // Ensure all values are valid numbers
  return {
    correctWords: Math.max(0, correctWords),
    totalWords: Math.max(0, totalWords),
    correctChars: Math.max(0, correctChars),
    totalChars: original.length,
    accuracy: Math.max(0, Math.min(100, Math.round(accuracy * 100) / 100)), // Clamp between 0-100
    wpm: Math.max(0, Math.round(wpm * 100) / 100),
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
