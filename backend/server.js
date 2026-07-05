/**
 * BizPilot AI - Express Server
 * Orchestrates the 5-agent pipeline: Intake → Context → Generation → Approval → Review
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const { runIntakeAgent } = require('./agents/intake');
const { runContextAgent } = require('./agents/context');
const { runGenerationAgent } = require('./agents/generation');
const { runApprovalAgent } = require('./agents/approval');
const { runReviewAgent } = require('./agents/review');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ─── In-Memory Log Store ─────────────────────────────────────────────────────
const interactionLogs = [];
const stats = {
  totalRequests: 0,
  totalVerified: 0,
  intentCounts: {
    quote_request: 0,
    invoice_request: 0,
    customer_query: 0,
    follow_up: 0,
    unclear: 0
  },
  totalResponseTime: 0
};

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BizPilot AI Backend',
    version: '1.0.0',
    aiMode: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here'
      ? 'gemini' : 'mock',
    timestamp: new Date().toISOString()
  });
});

// ─── Main Pipeline Endpoint ──────────────────────────────────────────────────
app.post('/api/process', async (req, res) => {
  const requestId = uuidv4();
  const globalStart = Date.now();

  const { message, language = 'en' } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const pipelineSteps = [];

  try {
    // Helper helper for delays
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // ── STEP 1: INTAKE AGENT ──────────────────────────────────────────────
    console.log(`[${requestId}] ► Intake Agent starting...`);
    const intakeDelay = Math.floor(450 + Math.random() * 250); // ~400-700ms
    await sleep(intakeDelay);
    const intakeResult = await runIntakeAgent(message.trim());
    intakeResult.duration = intakeDelay + (intakeResult.duration || 0);
    pipelineSteps.push(intakeResult);
    console.log(`[${requestId}] ✓ Intake Agent: ${intakeResult.summary}`);

    // ── STEP 2: CONTEXT AGENT ─────────────────────────────────────────────
    console.log(`[${requestId}] ► Context Agent starting...`);
    const contextDelay = Math.floor(300 + Math.random() * 200); // ~300-500ms
    await sleep(contextDelay);
    const contextResult = await runContextAgent(intakeResult.output, message.trim());
    contextResult.duration = contextDelay + (contextResult.duration || 0);
    pipelineSteps.push(contextResult);
    console.log(`[${requestId}] ✓ Context Agent: ${contextResult.summary}`);

    // ── STEP 3: GENERATION AGENT ──────────────────────────────────────────
    console.log(`[${requestId}] ► Generation Agent starting...`);
    const genDelay = Math.floor(600 + Math.random() * 300); // ~600-900ms
    await sleep(genDelay);
    const generationResult = await runGenerationAgent(contextResult.output, null, language);
    generationResult.duration = genDelay + (generationResult.duration || 0);
    pipelineSteps.push(generationResult);
    console.log(`[${requestId}] ✓ Generation Agent: ${generationResult.summary}`);

    // ── STEP 4: APPROVAL AGENT ────────────────────────────────────────────
    console.log(`[${requestId}] ► Approval Agent starting...`);
    const approvalResult = await runApprovalAgent(generationResult.output);
    pipelineSteps.push(approvalResult);
    console.log(`[${requestId}] ✓ Approval Agent: ${approvalResult.summary}`);

    // ── STEP 5: REVIEW AGENT (Self-Correction Loop) ───────────────────────
    console.log(`[${requestId}] ► Review Agent starting...`);
    const reviewDelay = Math.floor(400 + Math.random() * 200); // ~400-600ms
    await sleep(reviewDelay);
    let reviewResult = await runReviewAgent(
      generationResult,
      contextResult.output,
      intakeResult.output.extracted_entities,
      approvalResult
    );
    reviewResult.duration = reviewDelay + (reviewResult.duration || 0);
    pipelineSteps.push(reviewResult);
    console.log(`[${requestId}] ✓ Review Agent: ${reviewResult.summary}`);

    // ── Self-correction: max 1 retry ───────────────────────────────────────
    let finalGenerationResult = generationResult;
    let finalApprovalResult = approvalResult;
    let regenerated = false;

    if (reviewResult.needsRegeneration) {
      console.log(`[${requestId}] ↺ Review Agent triggered regeneration: ${reviewResult.feedback}`);
      const retryGenDelay = Math.floor(600 + Math.random() * 300);
      await sleep(retryGenDelay);
      finalGenerationResult = await runGenerationAgent(contextResult.output, reviewResult.feedback, language);
      finalGenerationResult.agent = 'GenerationAgent (Retry)';
      finalGenerationResult.duration = retryGenDelay + (finalGenerationResult.duration || 0);

      // Re-run Approval step on new document
      finalApprovalResult = await runApprovalAgent(finalGenerationResult.output);
      finalApprovalResult.agent = 'ApprovalAgent (Retry)';

      // Re-review after regeneration
      const retryReviewDelay = Math.floor(400 + Math.random() * 200);
      await sleep(retryReviewDelay);
      reviewResult = await runReviewAgent(
        finalGenerationResult,
        contextResult.output,
        intakeResult.output.extracted_entities,
        finalApprovalResult
      );
      reviewResult.agent = 'ReviewAgent (Final)';
      reviewResult.duration = retryReviewDelay + (reviewResult.duration || 0);

      pipelineSteps.push(finalGenerationResult);
      pipelineSteps.push(finalApprovalResult);
      pipelineSteps.push(reviewResult);
      regenerated = true;
      console.log(`[${requestId}] ✓ Regeneration complete: ${reviewResult.summary}`);
    }

    // ── Record visit AFTER current generation is complete ────────────────
    const customerName = contextResult.output.customer?.name;
    const isNamedCustomer = customerName && customerName !== 'Walk-in Customer' && customerName !== 'Walk-in';
    const isDoc = ['quote_request', 'invoice_request'].includes(intakeResult.output.intent);
    if (isNamedCustomer && isDoc) {
      store.recordVisit(customerName);
      console.log(`[server] Recorded visit for customer "${customerName}". Next visit will count as #${store.getVisitCount(customerName) + 1}.`);
    }

    // ── Build final response ───────────────────────────────────────────────
    const totalDuration = Date.now() - globalStart;
    const intent = intakeResult.output.intent;

    const response = {
      requestId,
      message: message.trim(),
      intent,
      pipelineSteps,
      generatedOutput: finalGenerationResult.output,
      reviewResult: reviewResult.output,
      approvalResult: finalApprovalResult.output,
      customerPhone: contextResult.output.customer?.phone || '',
      regenerated,
      verified: reviewResult.output.approved,
      totalDuration,
      timestamp: new Date().toISOString()
    };

    // ── Update Stats ──────────────────────────────────────────────────────
    stats.totalRequests++;
    stats.intentCounts[intent] = (stats.intentCounts[intent] || 0) + 1;
    stats.totalResponseTime += totalDuration;
    if (reviewResult.output.approved) stats.totalVerified++;

    // ── Log Interaction ───────────────────────────────────────────────────
    interactionLogs.unshift({
      id: requestId,
      timestamp: new Date().toISOString(),
      message: message.trim(),
      intent,
      status: reviewResult.output.approved ? 'verified' : 'review_failed',
      reviewResult: reviewResult.output.verified_flag,
      responseTime: totalDuration,
      regenerated,
      // Enhanced log fields:
      discountApplied: finalGenerationResult.output?.discountApplied || false,
      discountAmount: finalGenerationResult.output?.discountAmount || 0,
      sourcesUsed: contextResult.output.sourcesUsed || [],
      approvalStatus: finalApprovalResult.output?.status || 'skipped'
    });

    // Keep only last 100 logs
    if (interactionLogs.length > 100) interactionLogs.pop();

    console.log(`[${requestId}] ✅ Pipeline complete in ${totalDuration}ms | Intent: ${intent} | Verified: ${reviewResult.output.approved}`);
    res.json(response);

  } catch (error) {
    console.error(`[${requestId}] ❌ Pipeline error:`, error);
    res.status(500).json({
      error: 'Pipeline processing failed',
      message: error.message,
      requestId
    });
  }
});

// ─── Stats Endpoint ──────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const avgResponseTime = stats.totalRequests > 0
    ? Math.round(stats.totalResponseTime / stats.totalRequests)
    : 0;

  res.json({
    totalRequests: stats.totalRequests,
    totalVerified: stats.totalVerified,
    avgResponseTime,
    intentCounts: stats.intentCounts,
    recentLogs: interactionLogs.slice(0, 20)
  });
});

// ─── Logs Endpoint ───────────────────────────────────────────────────────────
app.get('/api/logs', (req, res) => {
  res.json({ logs: interactionLogs });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const aiMode = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here'
    ? '🤖 Gemini AI Mode' : '🔧 Mock AI Mode';
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║     BizPilot AI Backend v1.0.0        ║`);
  console.log(`╠═══════════════════════════════════════╣`);
  console.log(`║  Port: ${PORT}                            ║`);
  console.log(`║  Mode: ${aiMode}          ║`);
  console.log(`╚═══════════════════════════════════════╝\n`);
});

module.exports = app;
