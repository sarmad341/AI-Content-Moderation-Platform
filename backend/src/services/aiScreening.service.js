const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CATEGORY_DEFINITIONS = {
  "Graphic Violence":
    "Depictions of physical harm, gore, or serious injury to humans or animals.",
  "Hate Symbols":
    "Imagery associated with extremist ideologies or designated terrorist organizations.",
  "Self-Harm":
    "Visual content depicting or glorifying acts of self-inflicted injury.",
  "Extremist Propaganda":
    "Content that promotes, recruits for, or glorifies violent extremist movements.",
  "Weapons & Contraband":
    "Imagery depicting illegal weapons, drug manufacturing, or trafficking-related content.",
  "Harassment & Humiliation":
    "Imagery intended to degrade, threaten, or publicly humiliate an identifiable individual.",
};

/**
 * Builds the screening prompt for only the categories that are currently enabled.
 * Disabled categories are skipped entirely per business rule 3.1.1.
 */
function buildPrompt(activeCategories) {
  const categoryList = activeCategories
    .map((c) => `- "${c.name}": ${CATEGORY_DEFINITIONS[c.name]}`)
    .join("\n");

  return `You are an automated content moderation classifier. Analyze the provided image against ONLY the following categories:

${categoryList}

For EACH category listed above, return an assessment. Respond with ONLY valid JSON — no preamble, no markdown formatting, no code fences. The JSON must be an array with exactly one object per category, in this exact shape:

[
  {
    "category": "<exact category name as given above>",
    "detected": <true or false>,
    "confidence": <integer 0-100>,
    "reasoning": "<one concise sentence explaining the assessment>"
  }
]

CRITICAL RULE FOR "confidence":
"confidence" must always represent how strongly the image MATCHES the violation described in that category — NOT how certain you are in your own judgment.
- 0-10 = the image clearly does NOT show this violation (e.g. an ordinary safe photo). This should be the score for almost all categories on almost all normal images.
- 90-100 = the image clearly DOES show this violation.
- A score around 50 means genuinely ambiguous/borderline.
- "detected" must be true only when confidence is roughly above 50, and false otherwise.
- Do NOT confuse "I am 100% sure this is safe" with high confidence. Being sure it's safe means LOW confidence in the violation (e.g. confidence: 2, detected: false), not high confidence.

Example: a photo of people drinking coffee at a cafe should score confidence near 0 for every category listed, since none of these violations are present. A confidence of 95+ on a clearly safe photo is WRONG.

Return all ${activeCategories.length} categories. Do not invent categories not listed above.`;
}
/**
 * Defensive JSON parsing — strips markdown code fences if the model added them
 * despite instructions, since this is a common model failure mode.
 */
function parseModelResponse(rawText) {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned); // throws if invalid — caller handles retry
  if (!Array.isArray(parsed))
    throw new Error("Model response was not a JSON array.");
  return parsed;
}

/**
 * Fetches an image from a URL and converts it to base64, since Gemini's
 * Node SDK expects inline image data rather than a remote URL reference.
 */
async function fetchImageAsBase64(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`,
    );
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { base64, mimeType: contentType };
}

/**
 * Screens a single image against the given list of active (enabled) categories.
 * Returns raw category results — does NOT apply thresholds or compute outcome.
 * That logic lives in verdict.service.js, kept separate so AI behavior and
 * business rules can be tested/changed independently.
 *
 * @param {string} imageUrl - publicly accessible image URL
 * @param {Array} activeCategories - PolicyVersion.categories filtered to enabled === true
 * @returns {Promise<Array<{category, detected, confidence, reasoning}>>}
 */
async function screenImage(imageUrl, activeCategories) {
  if (!activeCategories.length) {
    // Nothing enabled — nothing to screen. Caller will treat this as Approved.
    return [];
  }

  const prompt = buildPrompt(activeCategories);
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  async function callModel() {
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      { text: prompt },
    ]);
    const text = result.response.text();
    return parseModelResponse(text);
  }

  try {
    return await callModel();
  } catch (firstErr) {
    console.warn("AI screening parse failed, retrying once:", firstErr.message);
    try {
      return await callModel();
    } catch (secondErr) {
      const err = new Error(
        "AI screening failed after retry: " + secondErr.message,
      );
      err.code = "AI_SCREENING_FAILED";
      throw err;
    }
  }
}

module.exports = { screenImage, CATEGORY_DEFINITIONS };
