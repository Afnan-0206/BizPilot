/**
 * APPROVAL AGENT (New Pipeline Step)
 * Logic:
 * - If doc is null (customer_query, follow_up, unclear intent) -> skip entirely, return null/pass through.
 * - If doc.total < 12000 (APPROVAL_THRESHOLD) -> auto-approve immediately.
 * - If doc.total >= 12000 -> simulate owner approval (Rahul Sharma) with ~800ms delay.
 */

const APPROVAL_THRESHOLD = 12000;

async function runApprovalAgent(doc) {
  const startTime = Date.now();

  const total = (doc && doc.financials) ? doc.financials.total : (doc ? doc.total : undefined);

  if (typeof total === 'undefined') {
    return {
      agent: 'ApprovalAgent',
      duration: Date.now() - startTime,
      output: {
        requiresApproval: false,
        status: 'skipped',
        reason: 'Skipped - non-financial request'
      },
      summary: 'Skipped'
    };
  }

  if (total < APPROVAL_THRESHOLD) {
    return {
      agent: 'ApprovalAgent',
      duration: Date.now() - startTime,
      output: {
        requiresApproval: false,
        status: 'auto_approved',
        reason: 'Below ₹12,000 threshold — auto-approved under standard sales workflow',
        documentTotal: total
      },
      summary: 'Auto-approved (below threshold)'
    };
  }

  // Else, simulate Owner Approval (Rahul Sharma) with a ~800ms delay
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    agent: 'ApprovalAgent',
    duration: Date.now() - startTime,
    output: {
      requiresApproval: true,
      status: 'approved',
      approver: 'Rahul Sharma',
      reason: 'High-value transaction — routed to Owner Approval, approved',
      documentTotal: total
    },
    summary: 'Approved by Rahul Sharma'
  };
}

module.exports = {
  runApprovalAgent,
  APPROVAL_THRESHOLD
};
