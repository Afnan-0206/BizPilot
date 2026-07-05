/**
 * SHARED IN-MEMORY CUSTOMER HISTORY STORE
 * Tracks customer visit counts within the current server session.
 * Used by Context Agent to detect returning customers and apply loyalty discounts.
 */

const customerHistory = {};

/**
 * Record a visit for the given customer and return their visit count.
 * Returns { visitCount, isReturning } where isReturning = visitCount > 1.
 */
function recordCustomerVisit(customerName) {
  if (!customerName || customerName === 'Walk-in Customer') {
    return { visitCount: 0, isReturning: false };
  }
  const key = customerName.toLowerCase().trim();
  customerHistory[key] = (customerHistory[key] || 0) + 1;
  return {
    visitCount: customerHistory[key],
    isReturning: customerHistory[key] > 1,
  };
}

/**
 * Peek at history without incrementing.
 */
function getCustomerHistory(customerName) {
  if (!customerName || customerName === 'Walk-in Customer') {
    return { visitCount: 0, isReturning: false };
  }
  const key = customerName.toLowerCase().trim();
  const count = customerHistory[key] || 0;
  return { visitCount: count, isReturning: count > 1 };
}

/**
 * Returns all known customers (for diagnostics / dashboard).
 */
function getAllCustomers() {
  return Object.entries(customerHistory).map(([name, visits]) => ({ name, visits }));
}

module.exports = { recordCustomerVisit, getCustomerHistory, getAllCustomers };
