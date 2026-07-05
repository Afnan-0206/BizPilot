/**
 * IN-MEMORY CUSTOMER VISIT TRACKER
 */

const visits = new Map();

function recordVisit(name) {
  if (!name || name === 'Walk-in Customer' || name === 'Walk-in') {
    return 0;
  }
  const key = name.toLowerCase().trim();
  const current = visits.get(key) || 0;
  const nextVal = current + 1;
  visits.set(key, nextVal);
  return nextVal;
}

function getVisitCount(name) {
  if (!name || name === 'Walk-in Customer' || name === 'Walk-in') {
    return 0;
  }
  const key = name.toLowerCase().trim();
  return visits.get(key) || 0;
}

function isReturningCustomer(name) {
  return getVisitCount(name) >= 1;
}

module.exports = {
  recordVisit,
  getVisitCount,
  isReturningCustomer
};
