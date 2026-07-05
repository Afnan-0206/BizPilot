/**
 * GENERATION AGENT
 * Generates quotations, invoices, customer replies, and follow-up messages.
 * Uses Claude API if available, falls back to template-based generation.
 */

const { getModel } = require('../lib/geminiClient');
const { v4: uuidv4 } = require('uuid');

// ─── Timeout wrapper ──────────────────────────────────────────────────────────
function withTimeout(promise, ms = 8000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

const KANNADA_DICT = {
  "Quotation Generated Successfully": "ಉದ್ಧರಣೆ ಯಶಸ್ವಿಯಾಗಿ ಸಿದ್ಧವಾಗಿದೆ",
  "Invoice Generated Successfully": "ಸರಕುಪಟ್ಟಿ ಯಶಸ್ವಿಯಾಗಿ ಸಿದ್ಧವಾಗಿದೆ",
  "Quotation No": "ಉದ್ಧರಣೆ ಸಂಖ್ಯೆ",
  "Invoice No": "ಸರಕುಪಟ್ಟಿ ಸಂಖ್ಯೆ",
  "Customer": "ಗ್ರಾಹಕರು",
  "Walk-in Customer": "ನೇರ ಗ್ರಾಹಕರು",
  "Date": "ದಿನಾಂಕ",
  "Items:": "ವಸ್ತುಗಳು:",
  "Subtotal": "ಉಪಮೊತ್ತ",
  "Loyalty Discount": "ನಿಷ್ಠಾವಂತ ಗ್ರಾಹಕ ರಿಯಾಯಿತಿ",
  "Discounted Subtotal": "ರಿಯಾಯಿತಿ ನಂತರದ ಉಪಮೊತ್ತ",
  "GST": "ಜಿಎಸ್‌ಟಿ",
  "Total": "ಒಟ್ಟು",
  "Payment: 50% advance": "ಪಾವತಿ: 50% ಮುಂಗಡ",
  "balance after installation": "ಉಳಿದ ಮೊತ್ತ ಅಳವಡಿಕೆಯ ನಂತರ",
  "Valid for 30 days": "30 ದಿನಗಳವರೆಗೆ ಮಾನ್ಯ",
  "Warranty: 1 year on all products": "ಖಾತರಿ: ಎಲ್ಲಾ ಉತ್ಪನ್ನಗಳಿಗೆ 1 ವರ್ಷ",
  "Thank you for choosing": "ಆಯ್ಕೆ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು",
  "Note:": "ಗಮನಿಸಿ:",
  "We've quoted our standard Dome Camera": "ನಾವು ನಮ್ಮ ಪ್ರಮಾಣಿತ ಡೋಮ್ ಕ್ಯಾಮೆರಾವನ್ನು ಉಲ್ಲೇಖಿಸಿದ್ದೇವೆ",
  "let us know if you need Bullet Cameras instead": "ನಿಮಗೆ ಬುಲೆಟ್ ಕ್ಯಾಮೆರಾಗಳು ಬೇಕಿದ್ದರೆ ನಮಗೆ ತಿಳಿಸಿ",
  "Returning customer": "ಮರು ಭೇಟಿ ನೀಡಿದ ಗ್ರಾಹಕರು",
  "loyalty discount applied": "ನಿಷ್ಠಾವಂತ ರಿಯಾಯಿತಿ ಅನ್ವಯಿಸಲಾಗಿದೆ"
};

const HINDI_DICT = {
  "Quotation Generated Successfully": "उद्धरण सफलतापूर्वक उत्पन्न हुआ",
  "Invoice Generated Successfully": "चालान सफलतापूर्वक उत्पन्न हुआ",
  "Quotation No": "उद्धरण संख्या",
  "Invoice No": "चालान संख्या",
  "Customer": "ग्राहक",
  "Walk-in Customer": "सामान्य ग्राहक",
  "Date": "दिनांक",
  "Items:": "सामग्री:",
  "Subtotal": "उप-योग",
  "Loyalty Discount": "वफादारी छूट",
  "Discounted Subtotal": "छूट के बाद उप-योग",
  "GST": "जीएसटी",
  "Total": "कुल",
  "Payment: 50% advance": "भुगतान: 50% अग्रिम",
  "balance after installation": "स्थापना के बाद शेष राशि",
  "Valid for 30 days": "30 दिनों के लिए मान्य",
  "Warranty: 1 year on all products": "वारंटी: सभी उत्पादों पर 1 वर्ष",
  "Thank you for choosing": "चुनने के लिए धन्यवाद",
  "Note:": "नोट:",
  "We've quoted our standard Dome Camera": "हमने अपने मानक डोम कैमरे को उद्धृत किया है",
  "let us know if you need Bullet Cameras instead": "अगर आपको बुलेट कैमरों की आवश्यकता हो तो हमें बताएं",
  "Returning customer": "वापस आने वाले ग्राहक",
  "loyalty discount applied": "वफादारी छूट लागू की गई"
};

function translateFallback(text, targetLanguage) {
  const dict = targetLanguage === 'kn' ? KANNADA_DICT : (targetLanguage === 'hi' ? HINDI_DICT : null);
  if (!dict) return text;
  
  let translated = text;
  for (const [english, translation] of Object.entries(dict)) {
    const regex = new RegExp(english, 'gi');
    translated = translated.replace(regex, translation);
  }
  return translated;
}

// ─── Translation via Gemini ───────────────────────────────────────────────────
async function translateWithGemini(text, targetLanguage) {
  if (!targetLanguage || targetLanguage === 'en') return text;

  const langNames = { kn: 'Kannada (ಕನ್ನಡ)', hi: 'Hindi (हिंदी)' };
  const langName = langNames[targetLanguage];
  if (!langName) return text;

  const systemPrompt = `You are a professional translator. Translate the following business message to ${langName}.
Rules:
- Keep all numbers, currency amounts (₹), document numbers, and proper nouns as-is in standard format
- Keep brand names (SecureVision Systems) and product names in English
- Maintain the same tone: professional but friendly
- Keep any asterisk (*text*) formatting intact
- Return ONLY the translated text, nothing else`;

  try {
    const model = getModel(false, systemPrompt);
    const response = await withTimeout(model.generateContent(text));
    return response.response.text().trim();
  } catch (err) {
    console.warn('[Generation Agent] Gemini translation failed, using dictionary fallback:', err.message);
    return translateFallback(text, targetLanguage);
  }
}

// ─── Document Number Generator ───────────────────────────────────────────────
function generateDocNumber(type) {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  const prefix = type === 'invoice' ? 'INV' : 'QUO';
  return `${prefix}-${year}${month}-${rand}`;
}

// ─── Financial Calculator (with optional loyalty discount) ──────────────────
function calculateTotals(items, taxRate, loyaltyDiscount = null) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  let discountAmount = 0;
  let discountPercent = 0;
  if (loyaltyDiscount?.applicable) {
    discountPercent = loyaltyDiscount.percentage || 5;
    discountAmount = Math.round(subtotal * (discountPercent / 100));
  }

  const discountedSubtotal = subtotal - discountAmount;
  const taxAmount = Math.round(discountedSubtotal * taxRate);
  const total = discountedSubtotal + taxAmount;

  return { subtotal, discountAmount, discountPercent, discountedSubtotal, taxAmount, total };
}

// ─── Document HTML Generator ─────────────────────────────────────────────────
function generateDocumentHTML(type, docNumber, customer, business, items, financials, terms, tax) {
  const typeLabel = type === 'invoice' ? 'INVOICE' : 'QUOTATION';
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const validUntil = type === 'quotation' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

  const itemRows = items.map((item, idx) => `
    <tr>
      <td class="td-num">${idx + 1}</td>
      <td>
        <div class="item-name">${item.name}</div>
        <div class="item-desc">${item.description || ''}</div>
      </td>
      <td class="td-center">${item.quantity}</td>
      <td class="td-right">₹${item.price.toLocaleString('en-IN')}</td>
      <td class="td-right">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${typeLabel} - ${docNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; }
  .doc-wrapper { max-width: 800px; margin: 0 auto; background: white; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #f59e0b; }
  .logo-section { display: flex; align-items: center; gap: 16px; }
  .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #1e3a5f, #f59e0b); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 800; }
  .biz-name { font-size: 22px; font-weight: 700; color: #1e3a5f; }
  .biz-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
  .biz-contact { font-size: 11px; color: #64748b; margin-top: 4px; }
  .doc-title-section { text-align: right; }
  .doc-badge { display: inline-block; background: ${type === 'invoice' ? '#10b981' : '#f59e0b'}; color: white; font-size: 13px; font-weight: 700; padding: 4px 14px; border-radius: 20px; letter-spacing: 2px; margin-bottom: 8px; }
  .doc-number { font-size: 18px; font-weight: 700; color: #1e3a5f; }
  .doc-date { font-size: 12px; color: #64748b; margin-top: 4px; }
  .meta-row { display: flex; gap: 24px; margin-bottom: 28px; }
  .meta-card { flex: 1; background: #f8fafc; border-radius: 10px; padding: 16px; border-left: 3px solid #f59e0b; }
  .meta-label { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .meta-value { font-size: 14px; font-weight: 600; color: #1e293b; }
  .meta-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead { background: #1e3a5f; color: white; }
  thead th { padding: 12px 14px; font-size: 12px; font-weight: 600; text-align: left; letter-spacing: 0.5px; }
  tbody tr { border-bottom: 1px solid #e2e8f0; }
  tbody tr:hover { background: #f8fafc; }
  td { padding: 12px 14px; font-size: 13px; }
  .td-num { color: #94a3b8; width: 40px; }
  .td-center { text-align: center; }
  .td-right { text-align: right; font-weight: 500; }
  .item-name { font-weight: 600; color: #1e293b; }
  .item-desc { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .totals-card { width: 280px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #475569; border-bottom: 1px solid #f1f5f9; }
  .total-row.final { font-size: 16px; font-weight: 700; color: #1e3a5f; border-top: 2px solid #f59e0b; border-bottom: none; padding-top: 12px; }
  .total-row.gst { color: #64748b; }
  .terms-section { background: #f8fafc; border-radius: 10px; padding: 20px; margin-bottom: 24px; }
  .terms-title { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 10px; }
  .terms-list { list-style: none; }
  .terms-list li { font-size: 11px; color: #64748b; padding: 3px 0; padding-left: 14px; position: relative; }
  .terms-list li::before { content: '•'; position: absolute; left: 0; color: #f59e0b; }
  .footer { text-align: center; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .footer-text { font-size: 11px; color: #94a3b8; }
  .verified-badge { display: inline-flex; align-items: center; gap: 6px; background: #d1fae5; color: #065f46; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; margin-top: 8px; }
  @media print { body { background: white; } .doc-wrapper { padding: 0; } }
</style>
</head>
<body>
<div class="doc-wrapper">
  <div class="header">
    <div class="logo-section">
      <div class="logo">${business.logo}</div>
      <div>
        <div class="biz-name">${business.name}</div>
        <div class="biz-subtitle">${business.type}</div>
        <div class="biz-contact">${business.phone} | ${business.email}</div>
        <div class="biz-contact">GST: ${business.gst}</div>
      </div>
    </div>
    <div class="doc-title-section">
      <div class="doc-badge">${typeLabel}</div>
      <div class="doc-number">${docNumber}</div>
      <div class="doc-date">Date: ${date}</div>
      ${validUntil ? `<div class="doc-date">Valid Until: ${validUntil}</div>` : ''}
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-card">
      <div class="meta-label">Bill To</div>
      <div class="meta-value">${customer.name}</div>
      <div class="meta-sub">Bengaluru, Karnataka</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Document No.</div>
      <div class="meta-value">${docNumber}</div>
      <div class="meta-sub">${date}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Payment Terms</div>
      <div class="meta-value">50% Advance</div>
      <div class="meta-sub">Balance after installation</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Item Description</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-card">
      <div class="total-row">
        <span>Subtotal</span>
        <span>₹${financials.subtotal.toLocaleString('en-IN')}</span>
      </div>
      ${financials.discountAmount > 0 ? `
      <div class="total-row" style="color:#10b981;">
        <span>🎁 Loyalty Discount (${financials.discountPercent}%)</span>
        <span>-₹${financials.discountAmount.toLocaleString('en-IN')}</span>
      </div>
      <div class="total-row" style="color:#475569;font-size:12px;">
        <span>Discounted Subtotal</span>
        <span>₹${financials.discountedSubtotal.toLocaleString('en-IN')}</span>
      </div>` : ''}
      <div class="total-row gst">
        <span>${tax.name} (${(tax.rate * 100)}%)</span>
        <span>₹${financials.taxAmount.toLocaleString('en-IN')}</span>
      </div>
      <div class="total-row final">
        <span>Total Amount</span>
        <span>₹${financials.total.toLocaleString('en-IN')}</span>
      </div>
    </div>
  </div>

  <div class="terms-section">
    <div class="terms-title">Terms & Conditions</div>
    <ul class="terms-list">
      ${terms.slice(0, 6).map(t => `<li>${t}</li>`).join('')}
    </ul>
  </div>

  <div class="footer">
    <div class="footer-text">Thank you for choosing ${business.name} | ${business.address}</div>
    <div class="footer-text" style="margin-top:4px">${business.phone} | ${business.email} | ${business.website}</div>
    <div class="verified-badge">✓ Verified by BizPilot AI Review Agent</div>
  </div>
</div>
</body>
</html>`;
}

// ─── Quote / Invoice Generator ──────────────────────────────────────────────
function generateQuoteOrInvoice(context, type) {
  const { customer, business, matchedItems, tax, terms, loyaltyDiscount } = context;
  const docNumber = generateDocNumber(type);

  // Recalculate everything cleanly from seed prices
  const items = matchedItems.map(item => ({
    ...item,
    lineTotal: item.price * item.quantity
  }));

  // Apply loyalty discount if applicable
  const financials = calculateTotals(items, tax.rate, loyaltyDiscount);

  const typeLabel = type === 'invoice' ? 'Invoice' : 'Quotation';
  const date = new Date().toLocaleDateString('en-IN');

  const itemList = items.map(item =>
    `  • ${item.name} x${item.quantity} @ ₹${item.price.toLocaleString('en-IN')} = ₹${item.lineTotal.toLocaleString('en-IN')}`
  ).join('\n');

  // Build discount lines for humanText
  const discountLines = financials.discountAmount > 0
    ? `🎁 Loyalty Discount (${financials.discountPercent}%): -₹${financials.discountAmount.toLocaleString('en-IN')}\nDiscounted Subtotal: ₹${financials.discountedSubtotal.toLocaleString('en-IN')}\n`
    : '';

  const assumptionSuffix = context.assumptionNote
    ? `\n\n💡 *Note:* We've quoted our standard Dome Camera — let us know if you need Bullet Cameras instead.`
    : '';

  const humanText = `📋 *${typeLabel} Generated Successfully*

${typeLabel} No: *${docNumber}*
Customer: *${customer.name}*
Date: ${date}
${financials.discountAmount > 0 ? `\n🎉 *Returning customer — 5% loyalty discount applied!*` : ''}

*Items:*
${itemList}

───────────────
Subtotal: ₹${financials.subtotal.toLocaleString('en-IN')}
${discountLines}GST (18%): ₹${financials.taxAmount.toLocaleString('en-IN')}
*Total: ₹${financials.total.toLocaleString('en-IN')}*
───────────────

Payment: 50% advance (₹${Math.round(financials.total / 2).toLocaleString('en-IN')}), balance after installation.
Valid for 30 days. Warranty: 1 year on all products.${assumptionSuffix}

_Thank you for choosing SecureVision Systems!_`;

  const documentHTML = generateDocumentHTML(
    type, docNumber, customer, business, items, financials, terms, tax
  );

  return {
    type,
    docNumber,
    customer,
    items,
    financials,
    humanText,
    documentHTML,
    date,
    discountApplied: financials.discountAmount > 0,
    discountAmount: financials.discountAmount
  };
}

// ─── Customer Query Generator ───────────────────────────────────────────────
async function generateCustomerQueryResponse(context, useAI) {
  const { relevantFAQs, policies, originalMessage } = context;

  if (useAI) {
    try {
      const faqContext = relevantFAQs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
      const policyContext = Object.entries(policies).map(([k, v]) => `${k}: ${v}`).join('\n');

      const systemPrompt = `You are a helpful customer support agent for SecureVision Systems, a CCTV & security installation company in Bengaluru.
Answer ONLY using the provided FAQ and policy data. Be concise, professional, and friendly.
Do NOT invent or hallucinate information not in the provided data.
Always respond in a professional, formal business tone regardless of how casual or informal the customer's original message was. Never mirror slang, abbreviations, or informal grammar back to the customer.
End with: "For more info, call +91 98765 43210 or WhatsApp us."`;

      const model = getModel(false, systemPrompt);
      const prompt = `Customer question: "${originalMessage}"\n\nFAQ Data:\n${faqContext}\n\nPolicies:\n${policyContext}`;

      const response = await withTimeout(model.generateContent(prompt));

      return {
        humanText: response.response.text().trim(),
        source: 'gemini'
      };
    } catch (err) {
      console.warn('[Generation Agent] Gemini failed for query, using FAQ match:', err.message);
    }
  }

  // Fallback: use matched FAQs
  if (relevantFAQs.length > 0) {
    const answers = relevantFAQs.map(f => f.answer).join('\n\n');
    return {
      humanText: `${answers}\n\nFor more info, call +91 98765 43210 or WhatsApp us.`,
      source: 'faq_match'
    };
  }

  // Fallback if no FAQ matched
  return {
    humanText: `Thank you for reaching out to SecureVision Systems! 

I'd be happy to help with your query. For specific information, please contact us:
📞 +91 98765 43210
📧 info@securevision.in
⏰ Mon-Sat, 9 AM to 7 PM

We're always here to assist you!`,
    source: 'default'
  };
}

// ─── Follow-up Generator ─────────────────────────────────────────────────────
async function generateFollowUp(context, useAI) {
  const { customer, business, originalMessage } = context;

  if (useAI) {
    try {
      const systemPrompt = `You are a professional sales assistant for SecureVision Systems, a CCTV company.
Write a short, friendly WhatsApp follow-up message (2-3 sentences max).
Be warm, professional, and create mild urgency without being pushy.
Always respond in a professional, formal business tone regardless of how casual or informal the customer's original message was. Never mirror slang, abbreviations, or informal grammar back to the customer.
Mention their pricing inquiry and offer to help finalize.
Sign off as: SecureVision Systems Team`;

      const model = getModel(false, systemPrompt);
      const prompt = `Generate a follow-up WhatsApp message. Context: "${originalMessage}". Customer: ${customer.name}`;

      const response = await withTimeout(model.generateContent(prompt));

      return { humanText: response.response.text().trim(), source: 'gemini' };
    } catch (err) {
      console.warn('[Generation Agent] Gemini failed for follow-up:', err.message);
    }
  }

  const name = customer.name !== 'Walk-in Customer' ? customer.name : 'there';
  return {
    humanText: `Hi ${name}! 👋 This is Rahul from SecureVision Systems. 

I wanted to follow up on the CCTV pricing inquiry you made recently. Our team is ready to assist you and can schedule a free site visit at your convenience.

We're currently offering a special deal — site visit charges waived for confirmed orders! Would love to get you set up with the best security solution.

Feel free to call or WhatsApp anytime: +91 98765 43210 😊

— SecureVision Systems Team`,
    source: 'template'
  };
}

// ─── Main Export ────────────────────────────────────────────────────────────
async function runGenerationAgent(enrichedContext, feedback = null, language = 'en') {
  const startTime = Date.now();
  const { intent } = enrichedContext;

  const useAI = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here');

  let result = {};
  let method = 'template';

  if (intent === 'quote_request') {
    result = generateQuoteOrInvoice(enrichedContext, 'quotation');
    method = 'template';
  } else if (intent === 'invoice_request') {
    result = generateQuoteOrInvoice(enrichedContext, 'invoice');
    method = 'template';
  } else if (intent === 'customer_query') {
    const queryResult = await generateCustomerQueryResponse(enrichedContext, useAI);
    method = queryResult.source === 'gemini' ? 'gemini' : 'template';
    result = {
      type: 'customer_query',
      humanText: queryResult.humanText,
      source: queryResult.source
    };
  } else if (intent === 'follow_up') {
    const followUpResult = await generateFollowUp(enrichedContext, useAI);
    method = followUpResult.source === 'gemini' ? 'gemini' : 'template';
    result = {
      type: 'follow_up',
      humanText: followUpResult.humanText,
      source: followUpResult.source
    };
  } else {
    result = {
      type: 'unclear',
      humanText: `I'm not quite sure what you need. Could you clarify your request?

Here's what I can help with:
• 📋 Generate a quotation (e.g., "Need quote for 3 cameras")
• 🧾 Create an invoice (e.g., "Invoice for 2 cameras and DVR")
• ❓ Answer questions (e.g., "What is your refund policy?")
• 💬 Send follow-ups (e.g., "Follow up with yesterday's customer")

Feel free to ask! — SecureVision Systems`
    };
  }

  if (feedback) {
    result.regenerated = true;
    result.feedbackApplied = feedback;
  }

  // Handle multilingual translation if language is not English
  if (language && language !== 'en' && result.humanText) {
    result.humanText = await translateWithGemini(result.humanText, language);
  }

  return {
    agent: 'GenerationAgent',
    method,
    duration: Date.now() - startTime,
    output: result,
    summary: `Generated: ${result.type || intent} | Doc: ${result.docNumber || 'N/A'}`
  };
}

module.exports = { runGenerationAgent };
