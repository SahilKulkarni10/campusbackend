/**
 * Create a standardized error object with status code and message
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @returns {Error} Error object with status and message
 */
const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export default createError; 