/**
 * Takes raw AI category results (from aiScreening.service.js) and the active
 * policy's category configs, and produces the final verdict outcome.
 *
 * This is where business rules 3.1.3 through 3.1.7 live — kept separate from
 * the AI service so policy logic can be tested/changed independently of
 * model behavior.
 */

/**
 * Applies threshold comparison to raw AI results, producing the final
 * categoryResults array to be stored on the Verdict document.
 *
 * @param {Array} aiResults - [{ category, detected, confidence, reasoning }]
 * @param {Array} policyCategories - the active PolicyVersion.categories (only enabled ones should be passed in)
 * @returns {Array} categoryResults with `triggered` computed per business rule 3.1.3
 */
function applyThresholds(aiResults, policyCategories) {
  const policyByName = new Map(policyCategories.map((c) => [c.name, c]));

  return aiResults.map((result) => {
    const policyConfig = policyByName.get(result.category);

    // Defensive fallback — shouldn't happen if the prompt only asked about
    // active categories, but guards against a model hallucinating a category.
    if (!policyConfig) {
      return { ...result, triggered: false };
    }

    const triggered = result.confidence >= policyConfig.threshold;

    return {
      category: result.category,
      detected: result.detected,
      confidence: result.confidence,
      reasoning: result.reasoning,
      triggered,
    };
  });
}

/**
 * Determines the final outcome for a single image's verdict, given its
 * triggered category results and the policy's enforcement settings.
 *
 * Business rules:
 * 3.1.4 - zero triggered categories => Approved
 * 3.1.5 - any triggered category with Auto-Block => Blocked (immediate)
 * 3.1.6 - any triggered category with Flag for Review (and no Auto-Block) => Flagged
 * 3.1.7 - Auto-Block takes precedence over Flag for Review when both are triggered
 *
 * @param {Array} categoryResults - output of applyThresholds()
 * @param {Array} policyCategories - the active PolicyVersion.categories
 * @returns {"Approved"|"Flagged"|"Blocked"}
 */
function determineOutcome(categoryResults, policyCategories) {
  const policyByName = new Map(policyCategories.map((c) => [c.name, c]));

  const triggeredCategories = categoryResults.filter((r) => r.triggered);

  if (triggeredCategories.length === 0) {
    return "Approved";
  }

  const hasAutoBlock = triggeredCategories.some((r) => {
    const config = policyByName.get(r.category);
    return config?.enforcement === "Auto-Block";
  });

  if (hasAutoBlock) {
    return "Blocked"; // precedence rule 3.1.7
  }

  // If we reach here, at least one triggered category exists and none were Auto-Block,
  // so by elimination at least one must be Flag for Review.
  return "Flagged";
}

/**
 * Full pipeline for a single image: runs threshold logic + outcome determination
 * in one call. This is what submissions.controller.js will actually use.
 *
 * @param {Array} aiResults - raw output from aiScreening.service.js screenImage()
 * @param {Array} policyCategories - active PolicyVersion.categories (enabled only)
 * @returns {{ outcome: string, categoryResults: Array }}
 */
function buildVerdict(aiResults, policyCategories) {
  const categoryResults = applyThresholds(aiResults, policyCategories);
  const outcome = determineOutcome(categoryResults, policyCategories);
  return { outcome, categoryResults };
}

/**
 * Recomputes a Submission's overallStatus from its constituent Verdicts,
 * per business rule 4.7 (Blocked > Flagged > Approved precedence).
 * Used both at submission-creation time and after an appeal acceptance
 * overrides one verdict's outcome.
 *
 * @param {Array<{outcome: string}>} verdicts - the Verdict documents for a submission
 * @returns {"Approved"|"Flagged"|"Blocked"}
 */
function computeOverallStatus(verdicts) {
  if (verdicts.some((v) => v.outcome === "Blocked")) return "Blocked";
  if (verdicts.some((v) => v.outcome === "Flagged")) return "Flagged";
  return "Approved";
}

module.exports = {
  applyThresholds,
  determineOutcome,
  buildVerdict,
  computeOverallStatus,
};
