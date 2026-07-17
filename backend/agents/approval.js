/**
 * APPROVAL AGENT
 *
 * Routing logic (two independent triggers, either is sufficient):
 *   1. VALUE THRESHOLD  — doc total >= ₹12,000 → owner approval
 *   2. STOCK SHORTFALL  — any 'insufficient' stock item → owner approval
 *      (regardless of order value — a back-order needs explicit confirmation)
 *
 * Non-financial requests (customer_query, follow_up, unclear) → skipped.
 * All approved orders below both triggers → auto-approved.
 */

const APPROVAL_THRESHOLD = 12000;

async function runApprovalAgent(generationOutput, contextOutput = null) {
  const startTime = Date.now();

  // generationOutput may be the raw generation result object or just the .output field.
  // Handle both shapes for backwards compatibility.
  const doc = generationOutput?.output ?? generationOutput;
  const total = doc?.financials?.total ?? doc?.total;

  // Skip non-financial intents (no total present)
  if (typeof total === 'undefined') {
    return {
      agent: 'ApprovalAgent',
      duration: Date.now() - startTime,
      output: {
        requiresApproval: false,
        status: 'skipped',
        reason: 'Skipped - non-financial request',
      },
      summary: 'Skipped',
    };
  }

  // ── Trigger 2: stock shortfall ────────────────────────────────────────────
  const stockNotes = doc?.stockNotes ?? contextOutput?.stockNotes ?? [];
  const insufficientItems = stockNotes.filter(n => n.status === 'insufficient');
  const hasStockShortfall = insufficientItems.length > 0;

  if (hasStockShortfall) {
    // Stock-shortfall approval needs the same ~800ms simulated review delay
    await new Promise(resolve => setTimeout(resolve, 800));
    const affected = insufficientItems.map(n =>
      `${n.product} (need ${n.requestedQty}, have ${n.availableQty})`
    ).join('; ');
    return {
      agent: 'ApprovalAgent',
      duration: Date.now() - startTime,
      output: {
        requiresApproval: true,
        status: 'approved',
        approver: 'Rahul Sharma',
        reason: `Stock shortfall — ${affected} — requires owner confirmation before proceeding`,
        documentTotal: total,
        stockShortfall: true,
        insufficientItems,
      },
      summary: `Approved by Rahul Sharma (stock shortfall: ${affected})`,
    };
  }

  // ── Trigger 1: value threshold ────────────────────────────────────────────
  if (total < APPROVAL_THRESHOLD) {
    return {
      agent: 'ApprovalAgent',
      duration: Date.now() - startTime,
      output: {
        requiresApproval: false,
        status: 'auto_approved',
        reason: 'Below ₹12,000 threshold — auto-approved under standard sales workflow',
        documentTotal: total,
        stockShortfall: false,
      },
      summary: 'Auto-approved (below threshold)',
    };
  }

  // High-value order → owner approval
  await new Promise(resolve => setTimeout(resolve, 800));
  return {
    agent: 'ApprovalAgent',
    duration: Date.now() - startTime,
    output: {
      requiresApproval: true,
      status: 'approved',
      approver: 'Rahul Sharma',
      reason: 'High-value transaction — routed to Owner Approval, approved',
      documentTotal: total,
      stockShortfall: false,
    },
    summary: 'Approved by Rahul Sharma',
  };
}

module.exports = {
  runApprovalAgent,
  APPROVAL_THRESHOLD,
};
