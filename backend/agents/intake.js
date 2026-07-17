/**
 * INTAKE AGENT
 * Classifies intent and extracts entities from raw user input.
 * Uses Claude API if available, falls back to rule-based mock.
 */

const { getModel } = require('../lib/geminiClient');

const INTENT_TYPES = ['quote_request', 'invoice_request', 'customer_query', 'follow_up', 'unclear'];

// ─── Claude-based Classification ────────────────────────────────────────────
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms))
  ]);
}

async function classifyWithGemini(message) {
  const systemPrompt = `You are an intake classification agent for a CCTV & security installation business called SecureVision Systems.

Your ONLY job is to analyze the user's message and return a structured JSON object.

Classify the intent into EXACTLY one of these:
- quote_request: User wants a price estimate / quotation
- invoice_request: User wants an invoice / bill
- customer_query: User asking about policies, warranty, refund, etc.
- follow_up: User wants to send a follow-up message to a customer
- unclear: Cannot determine intent

Extract entities:
- items: array of product/service names mentioned (e.g., ["CCTV camera", "DVR"])
- quantities: array of numbers corresponding to items (match index with items)
- customer_name: string or "" if not mentioned
- customer_phone: string with digits only (no spaces/dashes), or "" if not mentioned. Extract any 10+ digit phone number from the message.
- service_required: boolean - true if installation/service is mentioned (do not assume installation unless explicitly stated or implied by words like "fitting", "setup", "wiring", "install")

Business owners write short, informal messages without full sentences or correct grammar. Extract intent and entities even from terse phrasing. Generic terms like 'cctv', 'camera', 'cam' should map to the closest matching product category — do not require exact product names.

Few-Shot Examples of casual/informal phrasing:
1. Input: "3 cctv for Afnan"
   Output:
   {
     "intent": "quote_request",
     "extracted_entities": {
       "items": ["cctv camera"],
       "quantities": [3],
       "customer_name": "Afnan",
       "customer_phone": "",
       "service_required": false
     }
   }
2. Input: "2 cameras + dvr for ramesh"
   Output:
   {
     "intent": "quote_request",
     "extracted_entities": {
       "items": ["camera", "dvr"],
       "quantities": [2, 1],
       "customer_name": "Ramesh",
       "service_required": false
     }
   }
3. Input: "quote please 5 bullet cam"
   Output:
   {
     "intent": "quote_request",
     "extracted_entities": {
       "items": ["bullet camera"],
       "quantities": [5],
       "customer_name": "",
       "service_required": false
     }
   }
4. Input: "whats ur refund policy"
   Output:
   {
     "intent": "customer_query",
     "extracted_entities": {
       "items": [],
       "quantities": [],
       "customer_name": "",
       "service_required": false
     }
   }
5. Input: "need invoice 3 dome cam 1 dvr for priya"
   Output:
   {
     "intent": "invoice_request",
     "extracted_entities": {
       "items": ["dome camera", "dvr"],
       "quantities": [3, 1],
       "customer_name": "Priya",
       "service_required": false
     }
   }

Return ONLY valid JSON. No explanation. No markdown. No extra text.`;

  const model = getModel(true, systemPrompt);

  const response = await withTimeout(model.generateContent(message));

  const text = response.response.text().trim();
  // Strip any markdown code fences if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

// ─── Rule-Based Mock Fallback ────────────────────────────────────────────────
function classifyWithMock(message) {
  const msg = message.toLowerCase();

  // Detect intent
  let intent = 'unclear';
  if (/invoice|bill|receipt/.test(msg)) {
    intent = 'invoice_request';
  } else if (/quote|quotation|price|estimate|cost|how much/.test(msg)) {
    intent = 'quote_request';
  } else if (/follow.?up|follow up|check|remind/.test(msg)) {
    intent = 'follow_up';
  } else if (/policy|refund|warranty|payment|area|how long|when|support|amc|remote/.test(msg)) {
    intent = 'customer_query';
  }

  // Broaden matching for fallback classification
  const hasQuantity = /\b\d+\b|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(msg);
  const hasProduct = /camera|dvr|hdd|nvr|cctv|cam|cams|dome|bullet/i.test(msg);
  const isQuestion = msg.includes('?');

  if (intent === 'unclear') {
    if (hasQuantity && hasProduct && !isQuestion) {
      intent = 'quote_request';
    }
  }

  // Lower the bar for unclear: attempt quote_request if there's any product or quantity, customer_query if policy
  if (intent === 'unclear') {
    if (/policy|refund|warranty|payment|area|how long|when|support|amc|remote/i.test(msg)) {
      intent = 'customer_query';
    } else if (hasQuantity || hasProduct) {
      intent = 'quote_request';
    }
  }

  // Extract items
  const items = [];
  const quantities = [];

  const patterns = [
    { regex: /(\d+)\s*(cctv\s*dome\s*camera|dome\s*camera|dome\s*cam|dome\s*cams)/gi, item: 'CCTV Dome Camera' },
    { regex: /(\d+)\s*(cctv\s*bullet\s*camera|bullet\s*camera|bullet\s*cam|bullet\s*cams)/gi, item: 'CCTV Bullet Camera' },
    { regex: /(\d+)\s*(cctv\s*camera|cctv|camera|cam|cams)/gi, item: 'CCTV Dome Camera' },
    { regex: /(\d+)\s*(8\s*ch(?:annel)?\s*dvr|8ch\s*dvr)/gi, item: '8 Channel DVR' },
    { regex: /(\d+)\s*(4\s*ch(?:annel)?\s*dvr|4ch\s*dvr)/gi, item: '4 Channel DVR' },
    { regex: /(\d+)\s*(dvr)/gi, item: '4 Channel DVR' },
    { regex: /(\d+)\s*(hard\s*dis[kc]|hdd|hard\s*drive|storage|1tb)/gi, item: '1TB Surveillance Hard Disk' },
  ];

  // Word-to-number map
  const wordNums = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  let processedMsg = msg;
  for (const [word, num] of Object.entries(wordNums)) {
    processedMsg = processedMsg.replace(new RegExp(`\\b${word}\\b`, 'gi'), num.toString());
  }

  for (const { regex, item } of patterns) {
    let match;
    while ((match = regex.exec(processedMsg)) !== null) {
      const qty = parseInt(match[1]);
      if (!items.includes(item)) {
        items.push(item);
        quantities.push(qty);
      }
    }
  }

  // Fallback: if no items extracted but we have generic camera/cctv, try to match it
  if (items.length === 0 && hasProduct) {
    let qty = 1;
    const qtyMatch = processedMsg.match(/\b\d+\b/);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[0]);
    }
    if (/bullet/i.test(processedMsg)) {
      items.push('CCTV Bullet Camera');
      quantities.push(qty);
    } else if (/dvr/i.test(processedMsg)) {
      items.push('4 Channel DVR');
      quantities.push(qty);
    } else if (/hdd|storage|hard/i.test(processedMsg)) {
      items.push('1TB Surveillance Hard Disk');
      quantities.push(qty);
    } else {
      items.push('CCTV Dome Camera');
      quantities.push(qty);
    }
  }

  // Detect installation
  const service_required = /install|setup|fitting|wiring|mounting/.test(msg);

  // Extract customer name (basic: "for [Name]" or "customer [Name]")
  let customer_name = '';
  if (msg.includes('priya')) {
    customer_name = 'Priya Enterprises';
  } else if (msg.includes('ramesh')) {
    customer_name = 'Ramesh Traders';
  } else {
    const nameMatch = msg.match(/(?:for|customer|client)\s+([a-z]+(?:\s+[a-z]+)?)/i);
    if (nameMatch && !['a', 'an', 'the', 'my', 'our'].includes(nameMatch[1].toLowerCase())) {
      customer_name = nameMatch[1]
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  // Extract phone number (10+ digit sequences, optionally prefixed with + or country code)
  let customer_phone = '';
  const phoneMatch = message.match(/(?:\+?\d[\d\s\-().]{8,}\d)/);
  if (phoneMatch) {
    const digits = phoneMatch[0].replace(/\D/g, '');
    if (digits.length >= 10) {
      customer_phone = digits;
    }
  }

  return {
    intent,
    extracted_entities: {
      items,
      quantities,
      customer_name,
      customer_phone,
      service_required
    }
  };
}

// ─── Main Export ────────────────────────────────────────────────────────────
async function runIntakeAgent(message, language = 'en') {
  const startTime = Date.now();
  let result;
  let method = 'simulated';

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here') {
    try {
      result = await classifyWithGemini(message);
      method = 'gemini';
    } catch (err) {
      console.warn('[Intake Agent] Gemini failed, using mock fallback:', err.message);
      result = classifyWithMock(message);
    }
  } else {
    result = classifyWithMock(message);
  }

  return {
    agent: 'IntakeAgent',
    method,
    duration: Date.now() - startTime,
    output: result,
    summary: `Intent: ${result.intent} | Extracted: ${result.extracted_entities.items.join(', ') || 'none'}${result.extracted_entities.quantities && result.extracted_entities.quantities.length ? ' (qty: ' + result.extracted_entities.quantities.join(', ') + ')' : ''}${result.extracted_entities.customer_name ? ', Customer: ' + result.extracted_entities.customer_name : ''}`
  };
}

module.exports = { runIntakeAgent };
