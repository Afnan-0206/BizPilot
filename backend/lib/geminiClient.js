const { GoogleGenerativeAI } = require("@google/generative-ai");

// Retrieve API key. Use a dummy key if not present in env to prevent SDK constructor from throwing on import.
const apiKey = process.env.GEMINI_API_KEY || "dummy-key-placeholder";
const genAI = new GoogleGenerativeAI(apiKey);

function getModel(jsonMode = false, systemInstruction = undefined) {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction,
    generationConfig: jsonMode ? { responseMimeType: "application/json" } : {},
  });
}

module.exports = { getModel };
