/**
 * REVIEW AGENT - SELF-CORRECTION LOOP
 * Verifies the generated response for accuracy, completeness, and correctness.
 * If issues are found, triggers one regeneration cycle.
 * This is the key differentiator in the multi-agent pipeline.
 */

const seedData = require('../data/seed.json');
const { getModel } = require('../lib/geminiClient');

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms))
  ]);
}

// ─── Pricing Verifier ────────────────────────────────────────────────────────
function verifyPricing(generatedOutput) {
  const issues = [];

  if (!generatedOutput.items || generatedOutput.items.length === 0) {
    return { passed: true, issues }; // No items to verify
  }

  // Verify each line item against seed data
  for (const item of generatedOutput.items) {
    const seedProduct = [...seedData.products, ...seedData.services].find(p => p.id === item.id);
    if (!seedProduct) continue;

    if (item.price !== seedProduct.price) {
      issues.push(`Price mismatch for ${item.name}: generated Rs.${item.price}, expected Rs.${seedProduct.price}`);
    }

    const expectedLineTotal = seedProduct.price * item.quantity;
    if (item.lineTotal !== expectedLineTotal) {
      issues.push(`Line total mismatch for ${item.name}: generated Rs.${item.lineTotal}, expected Rs.${expectedLineTotal}`);
    }
  }

  // Verify financials (discount-aware)
  if (generatedOutput.financials) {
    const { subtotal, discountAmount = 0, discountPercent = 0, discountedSubtotal, taxAmount, total } = generatedOutput.financials;

    // Subtotal = sum of line items at full price (pre-discount)
    const expectedSubtotal = generatedOutput.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    if (subtotal !== expectedSubtotal) {
      issues.push(`Subtotal mismatch: generated Rs.${subtotal}, expected Rs.${expectedSubtotal}`);
    }

    // If discount applied: verify discount amount and discounted subtotal
    if (discountAmount > 0) {
      const expectedDiscountAmount = Math.round(expectedSubtotal * (discountPercent / 100));
      if (Math.abs(discountAmount - expectedDiscountAmount) > 1) {
        issues.push(`Discount amount mismatch: generated Rs.${discountAmount}, expected Rs.${expectedDiscountAmount}`);
      }
    }

    // Tax is on discounted subtotal (or full subtotal if no discount)
    const taxBase = (discountedSubtotal !== undefined) ? discountedSubtotal : expectedSubtotal;
    const expectedTax = Math.round(taxBase * seedData.tax.rate);
    if (Math.abs(taxAmount - expectedTax) > 1) {
      issues.push(`Tax mismatch: generated Rs.${taxAmount}, expected Rs.${expectedTax}`);
    }

    // Total = taxBase + tax
    const expectedTotal = taxBase + expectedTax;
    if (total !== expectedTotal) {
      issues.push(`Total mismatch: generated Rs.${total}, expected Rs.${expectedTotal}`);
    }
  }

  return { passed: issues.length === 0, issues };
}


// ─── Quantity Verifier ───────────────────────────────────────────────────────
function verifyQuantities(generatedOutput, extractedEntities) {
  const issues = [];

  if (!generatedOutput.items || !extractedEntities.items) {
    return { passed: true, issues };
  }

  // Check that camera counts match what user asked
  const userCameraCount = extractedEntities.items.reduce((sum, item, idx) => {
    if (/camera/i.test(item)) return sum + (extractedEntities.quantities[idx] || 1);
    return sum;
  }, 0);

  const generatedCameraCount = generatedOutput.items
    .filter(i => i.category === 'camera')
    .reduce((sum, i) => sum + i.quantity, 0);

  if (userCameraCount > 0 && generatedCameraCount !== userCameraCount) {
    issues.push(`Camera quantity mismatch: user requested ${userCameraCount}, generated ${generatedCameraCount}`);
  }

  return { passed: issues.length === 0, issues };
}

// ─── Completeness Verifier ───────────────────────────────────────────────────
function verifyCompleteness(generatedOutput, intent) {
  const issues = [];

  if (intent === 'quote_request' || intent === 'invoice_request') {
    if (!generatedOutput.docNumber) issues.push('Missing document number');
    if (!generatedOutput.customer) issues.push('Missing customer information');
    if (!generatedOutput.items || generatedOutput.items.length === 0) issues.push('No line items in document');
    if (!generatedOutput.financials || !generatedOutput.financials.total) issues.push('Missing total amount');
    if (!generatedOutput.humanText) issues.push('Missing human-readable response');
  } else if (intent === 'customer_query') {
    if (!generatedOutput.humanText || generatedOutput.humanText.length < 20) {
      issues.push('Response too short or empty for customer query');
    }
  } else if (intent === 'follow_up') {
    if (!generatedOutput.humanText || generatedOutput.humanText.length < 20) {
      issues.push('Follow-up message too short');
    }
  }

  return { passed: issues.length === 0, issues };
}

// ─── Tone Verifier ───────────────────────────────────────────────────────────
function verifyTone(generatedOutput) {
  const issues = [];
  const text = (generatedOutput.humanText || '').toLowerCase();

  const unprofessionalPatterns = [
    /\b(cheap|worst|bad|terrible|awful)\b/,
    /!!{3,}/,  // excessive exclamation
    /[A-Z]{5,}/, // excessive caps
  ];

  for (const pattern of unprofessionalPatterns) {
    if (pattern.test(text)) {
      issues.push(`Potentially unprofessional language detected in response`);
      break;
    }
  }

  return { passed: issues.length === 0, issues };
}

// ─── Facts Verifier ──────────────────────────────────────────────────────────
function verifyFacts(generatedOutput) {
  const issues = [];
  const text = (generatedOutput.humanText || '').toLowerCase();

  // Check for hallucinated discounts not in our data
  const suspiciousPatterns = [
    /\d+%\s*(off|discount)/i,
    /free\s*installation/i,
    /lifetime\s*warranty/i,
    /2\s*year\s*warranty/i,
    /3\s*year\s*warranty/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      // Check if this is actually in our data
      const allText = JSON.stringify(seedData).toLowerCase();
      if (!allText.includes(pattern.source?.split('\\')[0] || '')) {
        issues.push(`Potential hallucinated fact detected: "${pattern.toString()}"`);
      }
    }
  }

  return { passed: issues.length === 0, issues };
}

async function reviewWithGemini(generationResult, enrichedContext, extractedEntities, approvalResult) {
  const { output: draftOutput } = generationResult;
  const { intent } = enrichedContext;

  const systemInstruction = `You are a strict QA Review Agent for SecureVision Systems.
Your job is to review a generated draft response against the user's original request, the extracted entities, the business context/catalog, and the approval status.

You must output a JSON object containing verification checks and any issues found.

Here is the business catalog and policies:
${JSON.stringify(seedData, null, 2)}

Here is the draft response and metadata to verify:
- Intent: ${intent}
- User message: "${enrichedContext.originalMessage || ''}"
- Extracted Entities: ${JSON.stringify(extractedEntities, null, 2)}
- Draft Generated Output: ${JSON.stringify(draftOutput, null, 2)}
- Approval Result: ${JSON.stringify(approvalResult, null, 2)}

Verification Rules:
1. pricing_verified: Check if item prices match catalog, and all totals (subtotal, GST 18%, loyalty discount if applicable, total) are mathematically correct.
2. quantity_verified: Check if the number/quantity of cameras matches what the user requested.
3. tone_verified: Check if response is professional and polite. Flag if there are unprofessional words like "cheap", "worst", "bad", "terrible", "awful", or excessive caps/exclamations.
4. facts_verified: Check that no hallucinated facts are present (e.g. lifetime warranty, free installation, or unmentioned discounts).
5. completeness_verified: Check that all required info is present (e.g. document number, customer, line items, total, humanText for quote/invoice; or humanText of >= 20 chars for support/follow-up).
6. approval_verified: Check that if approval was required (total >= 12,000), it has status 'approved'. If not required, status 'auto_approved' or 'skipped'.

Respond ONLY with a JSON object in this format:
{
  "pricing_verified": boolean,
  "quantity_verified": boolean,
  "tone_verified": boolean,
  "facts_verified": boolean,
  "completeness_verified": boolean,
  "approval_verified": boolean,
  "issues": ["string explanation of any failures"]
}`;

  const model = getModel(true, systemInstruction);
  const prompt = `Please review the generated response.`;

  const response = await withTimeout(model.generateContent(prompt), 3000);
  const text = response.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

// ─── Main Review Function ────────────────────────────────────────────────────
async function runReviewAgent(generationResult, enrichedContext, extractedEntities, approvalResult = null) {
  const startTime = Date.now();
  const { output: draftOutput } = generationResult;
  const { intent } = enrichedContext;

  let reviewResult;
  let method = 'rule-based';

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here') {
    try {
      const geminiResult = await reviewWithGemini(generationResult, enrichedContext, extractedEntities, approvalResult);
      const approved = geminiResult.pricing_verified &&
                       geminiResult.quantity_verified &&
                       geminiResult.tone_verified &&
                       geminiResult.facts_verified &&
                       geminiResult.completeness_verified &&
                       geminiResult.approval_verified;

      reviewResult = {
        approved,
        verified_flag: approved ? 'Verified ✓' : 'Issues Found',
        issues: geminiResult.issues || [],
        checks: {
          pricing_verified: geminiResult.pricing_verified,
          quantity_verified: geminiResult.quantity_verified,
          tone_verified: geminiResult.tone_verified,
          facts_verified: geminiResult.facts_verified,
          completeness_verified: geminiResult.completeness_verified,
          approval_verified: geminiResult.approval_verified
        },
        final_response: draftOutput.humanText || ''
      };
      method = 'gemini';
    } catch (err) {
      console.warn('[Review Agent] Gemini review failed, using rule-based fallback:', err.message);
    }
  }

  // Fallback to rule-based verification if Gemini wasn't run or failed/timed out
  if (!reviewResult) {
    // Run all checks
    const pricingCheck = verifyPricing(draftOutput);
    const quantityCheck = verifyQuantities(draftOutput, extractedEntities);
    const completenessCheck = verifyCompleteness(draftOutput, intent);
    const toneCheck = verifyTone(draftOutput);
    const factsCheck = verifyFacts(draftOutput);

    // Verify approval step
    let approvalVerified = true;
    if (approvalResult && approvalResult.output) {
      const status = approvalResult.output.status;
      if (status === 'skipped' || status === 'auto_approved' || status === 'approved') {
        approvalVerified = true;
      } else {
        approvalVerified = false;
      }
    }

    const allIssues = [
      ...pricingCheck.issues,
      ...quantityCheck.issues,
      ...completenessCheck.issues,
      ...toneCheck.issues,
      ...factsCheck.issues
    ];

    if (!approvalVerified) {
      allIssues.push('High-value approval verification failed or pending');
    }

    const approved = allIssues.length === 0;

    reviewResult = {
      approved,
      verified_flag: approved ? 'Verified ✓' : 'Issues Found',
      issues: allIssues,
      checks: {
        pricing_verified: pricingCheck.passed,
        quantity_verified: quantityCheck.passed,
        tone_verified: toneCheck.passed,
        facts_verified: factsCheck.passed,
        completeness_verified: completenessCheck.passed,
        approval_verified: approvalVerified
      },
      final_response: draftOutput.humanText || ''
    };
    method = 'rule-based';
  }

  return {
    agent: 'ReviewAgent',
    method,
    duration: Date.now() - startTime,
    output: reviewResult,
    needsRegeneration: !reviewResult.approved,
    feedback: reviewResult.issues.length > 0 ? reviewResult.issues.join('; ') : null,
    summary: `${reviewResult.approved ? '✓ All checks passed' : `✗ ${reviewResult.issues.length} issue(s) found`} | Pricing: ${reviewResult.checks.pricing_verified ? '✓' : '✗'} | Qty: ${reviewResult.checks.quantity_verified ? '✓' : '✗'} | Complete: ${reviewResult.checks.completeness_verified ? '✓' : '✗'} | Approved: ${reviewResult.checks.approval_verified ? '✓' : '✗'}`
  };
}

module.exports = { runReviewAgent };

