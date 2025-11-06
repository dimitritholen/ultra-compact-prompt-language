/**
 * Test Date Helpers - Dynamic Date Generation Utilities
 *
 * Provides helper functions for generating dates relative to the current time,
 * eliminating the need for hardcoded year values in tests.
 *
 * All functions use the current date/time as the reference point to ensure
 * tests remain valid regardless of when they are executed.
 *
 * @module test-date-helpers
 */

/**
 * Get the current date and time
 * @returns {Date} Current date/time
 */
function now() {
  return new Date();
}

/**
 * Get current date at midnight (start of day)
 * @returns {Date} Today at 00:00:00.000
 */
function today() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Get a date N days in the past
 * @param {number} days - Number of days ago (positive number)
 * @returns {Date} Date representing N days before current time
 * @example
 * // Get the date 7 days ago
 * const lastWeek = daysAgo(7);
 */
function daysAgo(days) {
  if (typeof days !== 'number' || days < 0) {
    throw new Error('daysAgo() requires a non-negative number');
  }
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Get a date N days in the future
 * @param {number} days - Number of days ahead (positive number)
 * @returns {Date} Date representing N days after current time
 * @example
 * // Get the date 7 days from now
 * const nextWeek = daysFromNow(7);
 */
function daysFromNow(days) {
  if (typeof days !== 'number' || days < 0) {
    throw new Error('daysFromNow() requires a non-negative number');
  }
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Get a date N weeks in the past
 * @param {number} weeks - Number of weeks ago (positive number)
 * @returns {Date} Date representing N weeks before current time
 */
function weeksAgo(weeks) {
  if (typeof weeks !== 'number' || weeks < 0) {
    throw new Error('weeksAgo() requires a non-negative number');
  }
  return daysAgo(weeks * 7);
}

/**
 * Get a date N weeks in the future
 * @param {number} weeks - Number of weeks ahead (positive number)
 * @returns {Date} Date representing N weeks after current time
 */
function weeksFromNow(weeks) {
  if (typeof weeks !== 'number' || weeks < 0) {
    throw new Error('weeksFromNow() requires a non-negative number');
  }
  return daysFromNow(weeks * 7);
}

/**
 * Get a date N months in the past (approximate: 30 days per month)
 * @param {number} months - Number of months ago (positive number)
 * @returns {Date} Date representing approximately N months before current time
 */
function monthsAgo(months) {
  if (typeof months !== 'number' || months < 0) {
    throw new Error('monthsAgo() requires a non-negative number');
  }
  return daysAgo(months * 30);
}

/**
 * Get a date N months in the future (approximate: 30 days per month)
 * @param {number} months - Number of months ahead (positive number)
 * @returns {Date} Date representing approximately N months after current time
 */
function monthsFromNow(months) {
  if (typeof months !== 'number' || months < 0) {
    throw new Error('monthsFromNow() requires a non-negative number');
  }
  return daysFromNow(months * 30);
}

/**
 * Get a date N years in the past (approximate: 365 days per year)
 * @param {number} years - Number of years ago (positive number)
 * @returns {Date} Date representing approximately N years before current time
 */
function yearsAgo(years) {
  if (typeof years !== 'number' || years < 0) {
    throw new Error('yearsAgo() requires a non-negative number');
  }
  return daysAgo(years * 365);
}

/**
 * Get a date N years in the future (approximate: 365 days per year)
 * @param {number} years - Number of years ahead (positive number)
 * @returns {Date} Date representing approximately N years after current time
 */
function yearsFromNow(years) {
  if (typeof years !== 'number' || years < 0) {
    throw new Error('yearsFromNow() requires a non-negative number');
  }
  return daysFromNow(years * 365);
}

/**
 * Create a date at the start of the current year (UTC)
 * @returns {Date} January 1st of the current year at 00:00:00.000 UTC
 */
function startOfCurrentYear() {
  const date = new Date();
  const year = date.getUTCFullYear();
  // Create date using UTC to avoid timezone issues
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

/**
 * Create a date at the end of the current year
 * @returns {Date} December 31st of the current year at 23:59:59.999
 */
function endOfCurrentYear() {
  const date = new Date();
  date.setMonth(11, 31);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Create a date at the start of the current month
 * @returns {Date} 1st day of current month at 00:00:00.000
 */
function startOfCurrentMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Create a specific date relative to now by year/month/day offsets
 * Useful for creating dates like "first day of next month" or "same day last year"
 *
 * @param {Object} options - Offset options
 * @param {number} [options.years=0] - Years to add (negative for past)
 * @param {number} [options.months=0] - Months to add (negative for past)
 * @param {number} [options.days=0] - Days to add (negative for past)
 * @param {boolean} [options.startOfDay=false] - Set time to 00:00:00.000
 * @returns {Date} Calculated date
 */
function dateWithOffset(options = {}) {
  const { years = 0, months = 0, days = 0, startOfDay = false } = options;

  const date = new Date();

  if (years !== 0) {
    date.setFullYear(date.getFullYear() + years);
  }

  if (months !== 0) {
    date.setMonth(date.getMonth() + months);
  }

  if (days !== 0) {
    date.setDate(date.getDate() + days);
  }

  if (startOfDay) {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

/**
 * Format a date as ISO date string (YYYY-MM-DD)
 * @param {Date} date - Date to format
 * @returns {string} ISO date string
 */
function toISODate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Format a date as ISO month string (YYYY-MM)
 * @param {Date} date - Date to format
 * @returns {string} ISO month string
 */
function toISOMonth(date) {
  return date.toISOString().substring(0, 7);
}

module.exports = {
  now,
  today,
  daysAgo,
  daysFromNow,
  weeksAgo,
  weeksFromNow,
  monthsAgo,
  monthsFromNow,
  yearsAgo,
  yearsFromNow,
  startOfCurrentYear,
  endOfCurrentYear,
  startOfCurrentMonth,
  dateWithOffset,
  toISODate,
  toISOMonth
};
