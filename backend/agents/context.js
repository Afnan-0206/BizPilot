/**
 * CONTEXT AGENT
 * Fetches and enriches business data based on intent and extracted entities.
 *
 * NEW CAPABILITIES:
 * 1. Returning-Customer Personalization: tracks visit counts, applies 5% loyalty discount
 * 2. Multi-Source Context Labeling: attributes data to named sources
 *    - "Product Catalog"          → products, services, pricing
 *    - "Company Policy Document"  → refund, warranty, payment, area policies
 *    - "Service Interaction Log"  → past customer interactions
 */

const seedData = require('../data/seed.json');
const store = require('../lib/store');
const { getStockQty, LOW_STOCK_THRESHOLD } = require('../lib/store');

// ── Named Source Classifier ───────────────────────────────────────────────────
const POLICY_KEYWORDS = /refund|warranty|payment|terms|service area|area|cancel|guarantee|money.?back/i;
const PRODUCT_KEYWORDS = /camera|dvr|hdd|nvr|amc|remote|viewing|surveillance|cctv|installation|setup|cost|price/i;

function classifyFAQSource(faq) {
  if (POLICY_KEYWORDS.test(faq.question) || POLICY_KEYWORDS.test(faq.answer)) {
    return 'Company Policy Document';
  }
  return 'Product Catalog';
}

function computeSourcesUsed(intent, matchedItems, relevantFAQs, originalMessage) {
  const sources = new Set();

  if (matchedItems.length > 0) {
    sources.add('Product Catalog');
  }

  if (relevantFAQs.length > 0) {
    for (const faq of relevantFAQs) {
      sources.add(classifyFAQSource(faq));
    }
  }

  if (intent === 'follow_up') {
    sources.add('Service Interaction Log');
  }

  // Policy-flavoured queries with no FAQ match still cite the policy doc
  if (POLICY_KEYWORDS.test(originalMessage) && !sources.has('Company Policy Document')) {
    sources.add('Company Policy Document');
  }

  // Fallback: at least one source must always be cited
  if (sources.size === 0) {
    sources.add('Company Policy Document');
  }

  return [...sources];
}

// ── Product Matching ──────────────────────────────────────────────────────────
function matchProducts(items, quantities) {
  const matched = [];

  for (let i = 0; i < items.length; i++) {
    const itemName = items[i].toLowerCase().trim();
    const qty = quantities[i] || 1;

    // Check if it is a generic term
    const hasCameraWord = /camera|cctv|cam/i.test(itemName);
    const hasSpecifier = /dome|bullet/i.test(itemName);
    const isGeneric = hasCameraWord && !hasSpecifier;

    let found;
    if (isGeneric) {
      found = seedData.products.find(p => p.id === 'P001'); // CCTV Dome Camera
    } else {
      found = seedData.products.find(p =>
        p.aliases.some(alias => itemName.includes(alias) || alias.includes(itemName)) ||
        p.name.toLowerCase().includes(itemName)
      );
    }

    if (!found) {
      found = seedData.services.find(s =>
        s.aliases.some(alias => itemName.includes(alias) || alias.includes(itemName)) ||
        s.name.toLowerCase().includes(itemName)
      );
      if (found) {
        matched.push({ ...found, quantity: qty, type: 'service', lineTotal: found.price * qty });
        continue;
      }
    }

    if (found) {
      const matchedItem = { ...found, quantity: qty, type: 'product', lineTotal: found.price * qty };
      if (isGeneric) {
        matchedItem.isAssumed = true;
      }
      matched.push(matchedItem);
    }
  }

  return matched;
}

// ── Stock Availability Check ──────────────────────────────────────────────────
/**
 * For each matched product (not services), compare requested qty against
 * current in-memory stock and classify as:
 *   'insufficient'    — requested qty > available stock
 *   'low_after_order' — stock would reach <= LOW_STOCK_THRESHOLD after fulfilling this order
 *   'ok'              — plenty of stock remaining
 *
 * Services (no stockQty in seed, type==='service') are always 'ok'.
 */
function computeStockNotes(matchedItems) {
  const notes = [];
  for (const item of matchedItems) {
    if (item.type === 'service') continue;             // labour — no stock tracking
    const available = getStockQty(item.id);
    if (available === null) continue;                  // unknown product id
    const requested = item.quantity;
    const remaining = available - requested;

    let status;
    if (requested > available) {
      status = 'insufficient';
    } else if (remaining <= LOW_STOCK_THRESHOLD) {
      status = 'low_after_order';
    } else {
      status = 'ok';
    }

    notes.push({
      productId: item.id,
      product: item.name,
      requestedQty: requested,
      availableQty: available,
      remainingAfterOrder: Math.max(0, remaining),
      status,
    });
  }
  return notes;
}

// ── FAQ Matching ──────────────────────────────────────────────────────────────
function matchFAQs(message) {
  const msg = message.toLowerCase();
  return seedData.faq.filter(faq =>
    faq.question.toLowerCase().split(' ').some(word => word.length > 3 && msg.includes(word))
  );
}

// ── Smart Installation Addition ───────────────────────────────────────────────
function addInstallationIfNeeded(matchedItems, serviceRequired) {
  if (!serviceRequired) return matchedItems;

  const cameraCount = matchedItems
    .filter(item => item.category === 'camera')
    .reduce((sum, item) => sum + item.quantity, 0);

  if (cameraCount === 0) return matchedItems;

  const hasInstallation = matchedItems.some(item =>
    item.id === 'S001' || (item.name && item.name.toLowerCase().includes('installation'))
  );

  if (!hasInstallation) {
    const installService = seedData.services.find(s => s.id === 'S001');
    if (installService) {
      matchedItems.push({
        ...installService,
        quantity: cameraCount,
        type: 'service',
        lineTotal: installService.price * cameraCount
      });
    }
  }

  return matchedItems;
}

// ── Main Export ───────────────────────────────────────────────────────────────
async function runContextAgent(intakeOutput, originalMessage) {
  const startTime = Date.now();
  const { intent, extracted_entities } = intakeOutput;
  const { items = [], quantities = [], customer_name = '', customer_phone = '', service_required = false } = extracted_entities;

  let matchedItems = [];
  let relevantFAQs = [];
  let contextType = 'general';

  if (intent === 'quote_request' || intent === 'invoice_request') {
    matchedItems = matchProducts(items, quantities);
    matchedItems = addInstallationIfNeeded(matchedItems, service_required);
    contextType = intent === 'quote_request' ? 'quotation' : 'invoice';
  } else if (intent === 'customer_query') {
    relevantFAQs = matchFAQs(originalMessage);
    contextType = 'faq';
  } else if (intent === 'follow_up') {
    contextType = 'follow_up';
  }

  // Check for generic camera assumptions
  const hasGenericCamera = matchedItems.some(item => item.isAssumed);
  let assumptionNote = null;
  if (hasGenericCamera) {
    assumptionNote = "Assumed CCTV Dome Camera (most common) — customer didn't specify camera type.";
  }

  // ── Stock Availability Check ───────────────────────────────────────────────
  const stockNotes = computeStockNotes(matchedItems);
  const hasStockIssue = stockNotes.some(n => n.status === 'insufficient');
  const hasLowStock   = stockNotes.some(n => n.status === 'low_after_order');

  // ── Returning-Customer Personalization ─────────────────────────
  let loyaltyDiscount = null;
  let customerNote = null;
  const isNamedCustomer = customer_name && customer_name !== 'Walk-in Customer';

  if (isNamedCustomer && (intent === 'quote_request' || intent === 'invoice_request')) {
    const isReturning = store.isReturningCustomer(customer_name);
    const visitCount = store.getVisitCount(customer_name);
    
    if (isReturning) {
      loyaltyDiscount = {
        applicable: true,
        percentage: 5,
        visitCount: visitCount,
      };
      customerNote = `Returning customer detected (visit #${visitCount + 1}) → 5% loyalty discount applied`;
      console.log(`[ContextAgent] ${customerNote} for "${customer_name}"`);
    } else {
      customerNote = `New customer "${customer_name}" — added to profile (visit #1)`;
      console.log(`[ContextAgent] ${customerNote}`);
    }
  }

  // ── Multi-Source Context Labeling ──────────────────────────────
  const sourcesUsed = computeSourcesUsed(intent, matchedItems, relevantFAQs, originalMessage);

  // Look up any matching Service Interaction Log entries for the customer
  const interactionHistory = (seedData.serviceInteractionLog || []).filter(log =>
    isNamedCustomer && log.customer.toLowerCase().includes(customer_name.toLowerCase())
  );

  // ── Assemble enriched context ─────────────────────────────────────────────
  const enrichedContext = {
    intent,
    contextType,
    customer: {
      name: customer_name || 'Walk-in Customer',
      phone: customer_phone || '',
      provided: !!customer_name,
    },
    business: seedData.business,
    matchedItems,
    relevantFAQs,
    policies: seedData.policies,
    terms: seedData.terms,
    tax: seedData.tax,
    originalMessage,
    service_required,
    allProducts: seedData.products,
    allServices: seedData.services,
    // Personalization
    loyaltyDiscount,
    customerNote,
    interactionHistory,
    // Source attribution
    sourcesUsed,
    // Generic assumption
    assumptionNote,
    // Stock awareness
    stockNotes,
    hasStockIssue,
    hasLowStock,
  };

  const loyaltyNote = loyaltyDiscount?.applicable
    ? ` | LOYALTY: ${loyaltyDiscount.percentage}% off (visit #${loyaltyDiscount.visitCount + 1})`
    : customerNote
      ? ` | ${customerNote}`
      : '';

  const stockNote = hasStockIssue
    ? ` | ⚠ STOCK SHORTFALL: ${stockNotes.filter(n => n.status === 'insufficient').map(n => `${n.product}(need ${n.requestedQty}, have ${n.availableQty})`).join(', ')}`
    : hasLowStock
      ? ` | LOW STOCK after order`
      : '';

  return {
    agent: 'ContextAgent',
    duration: Date.now() - startTime,
    output: enrichedContext,
    summary: `Sources: ${sourcesUsed.join(', ')} | Items: ${matchedItems.length}${loyaltyNote}${assumptionNote ? ` | Note: ${assumptionNote}` : ''}${stockNote}`,
  };
}

module.exports = { runContextAgent };
