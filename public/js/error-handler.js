/**
 * Error Handler Module
 * 
 * Centralized error handling and validation
 */

/**
 * Handle and log errors consistently
 * @param {Error|string} error - Error object or message
 * @param {string} context - Where the error occurred
 * @returns {Object} - Formatted error response
 */
export function handleError(error, context = 'Unknown') {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorDetails = {
    message: errorMessage,
    context: context,
    timestamp: new Date().toISOString()
  };
  
  console.error(`[${context}] Error:`, errorDetails);
  
  // You can extend this to send errors to a logging service
  // For example: sendToErrorLoggingService(errorDetails);
  
  return {
    success: false,
    error: errorMessage,
    details: errorDetails
  };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate room code format
 * @param {string} roomCode - Room code to validate
 * @returns {boolean} - True if valid
 */
export function validateRoomCode(roomCode) {
  return /^[A-Z0-9]{6}$/.test(roomCode);
}

/**
 * Validate user input
 * @param {Object} data - Data to validate
 * @param {Array} rules - Validation rules
 * @returns {Object} - Validation result
 */
export function validateInput(data, rules) {
  const errors = [];
  
  for (const rule of rules) {
    const value = data[rule.field];
    
    // Required check
    if (rule.required && (!value || value.trim() === '')) {
      errors.push(`${rule.field} is required`);
      continue;
    }
    
    // Type check
    if (value && rule.type) {
      if (rule.type === 'email' && !validateEmail(value)) {
        errors.push(`${rule.field} must be a valid email`);
      } else if (rule.type === 'number' && isNaN(value)) {
        errors.push(`${rule.field} must be a number`);
      } else if (rule.type === 'roomCode' && !validateRoomCode(value)) {
        errors.push(`${rule.field} must be a 6-character alphanumeric code`);
      }
    }
    
    // Length check
    if (value && rule.minLength && value.length < rule.minLength) {
      errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
    }
    
    if (value && rule.maxLength && value.length > rule.maxLength) {
      errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
    }
    
    // Range check
    if (value && rule.min !== undefined && Number(value) < rule.min) {
      errors.push(`${rule.field} must be at least ${rule.min}`);
    }
    
    if (value && rule.max !== undefined && Number(value) > rule.max) {
      errors.push(`${rule.field} must be at most ${rule.max}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Safe async function wrapper with error handling
 * @param {Function} asyncFn - Async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Promise} - Wrapped function result
 */
export async function safeAsync(asyncFn, context = 'Unknown') {
  try {
    return await asyncFn();
  } catch (error) {
    return handleError(error, context);
  }
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in ms
 * @returns {Promise} - Function result
 */
export async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

