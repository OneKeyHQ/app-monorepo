#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PR_TYPES = [
  'revert',
  'deps_or_ci',
  'cross_platform_migration',
  'core_feature',
  'targeted_bugfix',
];

const SEVERITIES = new Set(['P0', 'P1', 'P2']);

const GATE_MODES = new Set(['shadow', 'soft', 'strict']);

const HIGH_RISK_SAFETY_CATEGORIES = new Set([
  'security',
  'funds_loss',
  'crash',
  'data_corruption',
]);

const BASE_IMPACT = {
  security: 40,
  funds_loss: 40,
  crash: 40,
  build_registry: 40,
  cross_platform_divergence: 32,
  half_migration: 32,
  code_duplication: 32,
  concurrency_race: 32,
  data_corruption: 32,
  runtime_boundary: 26,
  memory_leak: 26,
  error_handling: 26,
  performance: 18,
  edge_case: 18,
  a11y_or_motion: 8,
  ui_polish: 8,
  style_nit: 8,
};

const FINDING_CATEGORIES = Object.keys(BASE_IMPACT);

// Alignment multiplier: [prType][category]
const TYPE_ALIGNMENT_MATRIX = {
  revert: {
    security: 1.3,
    funds_loss: 1.3,
    crash: 1.3,
    build_registry: 1.3,
    data_corruption: 1.1,
    concurrency_race: 0.8,
    runtime_boundary: 0.8,
    memory_leak: 0.6,
    error_handling: 0.4,
    cross_platform_divergence: 0.0,
    half_migration: 0.0,
    code_duplication: 0.0,
    performance: 0.0,
    edge_case: 0.0,
    a11y_or_motion: 0.0,
    ui_polish: 0.0,
    style_nit: 0.0,
  },
  deps_or_ci: {
    security: 1.4,
    funds_loss: 1.3,
    crash: 1.2,
    build_registry: 1.4,
    data_corruption: 1.0,
    runtime_boundary: 0.9,
    concurrency_race: 0.5,
    memory_leak: 0.4,
    error_handling: 0.4,
    cross_platform_divergence: 0.0,
    half_migration: 0.0,
    code_duplication: 0.0,
    performance: 0.3,
    edge_case: 0.0,
    a11y_or_motion: 0.0,
    ui_polish: 0.0,
    style_nit: 0.0,
  },
  cross_platform_migration: {
    security: 1.2,
    funds_loss: 1.3,
    crash: 1.2,
    build_registry: 1.2,
    cross_platform_divergence: 1.5,
    half_migration: 1.5,
    code_duplication: 1.5,
    runtime_boundary: 1.3,
    concurrency_race: 1.2,
    data_corruption: 1.2,
    memory_leak: 1.2,
    error_handling: 0.9,
    performance: 0.9,
    edge_case: 0.5,
    a11y_or_motion: 0.2,
    ui_polish: 0.3,
    style_nit: 0.0,
  },
  core_feature: {
    security: 1.4,
    funds_loss: 1.4,
    crash: 1.3,
    build_registry: 1.2,
    data_corruption: 1.4,
    concurrency_race: 1.3,
    runtime_boundary: 1.2,
    memory_leak: 1.1,
    cross_platform_divergence: 1.1,
    half_migration: 1.0,
    code_duplication: 1.1,
    error_handling: 1.0,
    performance: 0.9,
    edge_case: 0.7,
    a11y_or_motion: 0.2,
    ui_polish: 0.4,
    style_nit: 0.0,
  },
  targeted_bugfix: {
    security: 1.3,
    funds_loss: 1.3,
    crash: 1.3,
    build_registry: 1.2,
    data_corruption: 1.3,
    concurrency_race: 1.3,
    runtime_boundary: 1.2,
    memory_leak: 1.1,
    error_handling: 1.0,
    cross_platform_divergence: 0.9,
    half_migration: 0.8,
    code_duplication: 0.8,
    performance: 0.8,
    edge_case: 0.6,
    a11y_or_motion: 0.2,
    ui_polish: 0.3,
    style_nit: 0.0,
  },
};

const THRESHOLDS = {
  PUBLISH_MIN_SCORE: 70,
  PUBLISH_P0_MIN_SCORE: 55,
  SUMMARY_MIN_SCORE: 50,
  REQUEST_CHANGES_P1_MIN_SCORE: 85,
  MAX_INLINE_COMMENTS: 5,
};

const A11Y_OR_MOTION_RE =
  /\b(voiceover|talkback|screen\s*readers?|assistive\s+technolog|accessibilitylabel|accessibilityrole|aria-[a-z]+|contentdescription|spoken\s+(?:value|text)|reduce[d]?\s+motion|keyboard\s+(?:navigation|focus|operable|accessible)|focus\s+(?:ring|indicator|frame)|tab\s*order|tabindex|separating\s+hinge|accessible\s+name)\b/i;

const SPECULATIVE_TITLE_RE =
  /^\s*(?:P[0-2]\s*:\s*)?\[?\s*(confirm|verify|check\s+whether|check\s+if|ensure\s+that|double[- ]check)\b/i;

const DEPS_OR_CI_FILE_RE =
  /(^|\/)(package\.json|yarn\.lock|Podfile\.lock|Gemfile\.lock|Cargo\.lock|renovate\.json|\.github\/workflows\/|\.github\/actions\/)/i;

const PLATFORM_SUFFIX_RE =
  /\.(native|ios|android|web|desktop|ext)\.(ts|tsx|js|jsx)$/i;

const CROSS_PLATFORM_MIGRATION_HINT_RE =
  /(NativeList|AppPager|CollapsiblePagerView|Tabs\.Container|legacy[A-Z]|module-id-registry\.json)/;

const SECURITY_CRITICAL_FILE_RE =
  /(^|\/)(vault|signing|crypto|auth|manifest|keyring|hardware|bundle-registry|dbs\/local\/consts\.ts)/i;

const A11Y_PR_HINT_RE =
  /\b(a11y|accessibility|voiceover|talkback|screen\s*reader|wcag)\b/i;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  return filePath
    .replace(/^a\/|^b\//, '')
    .replace(/^\.\//, '')
    .trim();
}

function stripLineSuffix(target) {
  if (!target || typeof target !== 'string') return '';
  return normalizePath(target.replace(/:L?\d+(?:-L?\d+)?$/i, ''));
}

function normalizeTitleForDedup(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/^p[0-2]\s*:\s*/i, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
}

/**
 * Safely parse LLM JSON output, tolerating markdown code fences or surrounding prose.
 * Never throws; returns structured ok/error result so pilot modes can fail-open.
 */
function parseReviewDraftSafely(rawText) {
  if (rawText && typeof rawText === 'object') {
    return { ok: true, draft: rawText, error: null, recoveredFromFence: false };
  }
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      ok: false,
      draft: null,
      error: 'Empty review draft input.',
      recoveredFromFence: false,
    };
  }
  try {
    return {
      ok: true,
      draft: JSON.parse(text),
      error: null,
      recoveredFromFence: false,
    };
  } catch {
    // Try stripping ```json ... ``` fence or extracting outermost JSON object
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenceMatch ? fenceMatch[1].trim() : text;
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return {
          ok: true,
          draft: JSON.parse(candidate.slice(firstBrace, lastBrace + 1)),
          error: null,
          recoveredFromFence: true,
        };
      } catch (innerErr) {
        return {
          ok: false,
          draft: null,
          error: `Failed to parse extracted JSON: ${innerErr.message}`,
          recoveredFromFence: false,
        };
      }
    }
    return {
      ok: false,
      draft: null,
      error: 'No valid JSON object found in review draft.',
      recoveredFromFence: false,
    };
  }
}

/**
 * Parse unified diff text into a map of changed right-side line ranges per file.
 * @param {string} diffText
 * @returns {Record<string, Array<{ start: number, end: number }>>}
 */
function parseUnifiedDiffHunks(diffText) {
  const fileHunks = {};
  if (!diffText || typeof diffText !== 'string') {
    return fileHunks;
  }
  let currentFile = null;
  const lines = diffText.split(/\r?\n/);
  for (const line of lines) {
    const fileMatch = line.match(/^\+\+\+\s+(?:b\/)?(.+)$/);
    if (fileMatch) {
      const candidate = fileMatch[1].trim();
      if (candidate === '/dev/null') {
        currentFile = null;
      } else {
        currentFile = normalizePath(candidate);
        if (!fileHunks[currentFile]) {
          fileHunks[currentFile] = [];
        }
      }
    } else if (currentFile) {
      const hunkMatch = line.match(
        /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/,
      );
      if (hunkMatch) {
        const start = Number(hunkMatch[1]);
        const count = hunkMatch[2] === undefined ? 1 : Number(hunkMatch[2]);
        const end = count > 0 ? start + count - 1 : start;
        fileHunks[currentFile].push({ start, end });
      }
    }
  }
  return fileHunks;
}

function isLineInDiffHunks(fileHunks, filePath, lineNumber, tolerance = 3) {
  const norm = normalizePath(filePath);
  const hunks = fileHunks[norm];
  if (!hunks || hunks.length === 0) return false;
  if (typeof lineNumber !== 'number' || !Number.isFinite(lineNumber)) {
    return true;
  }
  return hunks.some(
    (h) => lineNumber >= h.start - tolerance && lineNumber <= h.end + tolerance,
  );
}

/**
 * Extract an objective PR profile from PR metadata and diff signals.
 */
function extractObservedProfile(prContext = {}) {
  const title = String(prContext.title || '');
  const body = String(prContext.body || '');
  const labels = Array.isArray(prContext.labels)
    ? prContext.labels.map((l) => String(l))
    : [];
  const files = Array.isArray(prContext.files)
    ? prContext.files.map(normalizePath).filter(Boolean)
    : [];
  const diffText = String(prContext.diffText || '');
  const existingAutoThreadCount = Number(
    prContext.existingAutoThreadCount || 0,
  );
  const reviewRound = Number(prContext.reviewRound || 1);

  const isRevert =
    /^\s*revert(\([^)]+\))?:/i.test(title) ||
    /^\s*revert\s+"/i.test(title) ||
    /\bthis reverts commit\b/i.test(body);

  const depsOrCiFiles = files.filter((f) => DEPS_OR_CI_FILE_RE.test(f));
  const isDepsOrCi =
    !isRevert && files.length > 0 && depsOrCiFiles.length / files.length >= 0.8;

  const platformFiles = files.filter((f) => PLATFORM_SUFFIX_RE.test(f));
  const hasCrossPlatformSignals =
    !isRevert &&
    (platformFiles.length > 0 ||
      files.some((f) => CROSS_PLATFORM_MIGRATION_HINT_RE.test(f)) ||
      CROSS_PLATFORM_MIGRATION_HINT_RE.test(diffText));

  const hasSecurityCriticalSignals = files.some((f) =>
    SECURITY_CRITICAL_FILE_RE.test(f),
  );

  const isA11yTarget =
    A11Y_PR_HINT_RE.test(title) || labels.some((l) => A11Y_PR_HINT_RE.test(l));

  const isFollowUpRound = existingAutoThreadCount > 0 || reviewRound >= 2;

  const isFixTitle = /^\s*fix(\([^)]+\))?:/i.test(title);

  let expectedTypes;
  if (isRevert) {
    expectedTypes = ['revert'];
  } else if (isDepsOrCi) {
    expectedTypes = ['deps_or_ci'];
  } else if (hasCrossPlatformSignals) {
    expectedTypes = [
      'cross_platform_migration',
      'core_feature',
      'targeted_bugfix',
    ];
  } else if (isFixTitle) {
    expectedTypes = ['targeted_bugfix', 'core_feature'];
  } else {
    expectedTypes = [
      'core_feature',
      'cross_platform_migration',
      'targeted_bugfix',
    ];
  }

  return {
    isRevert,
    isDepsOrCi,
    hasCrossPlatformSignals,
    hasSecurityCriticalSignals,
    isA11yTarget,
    isFollowUpRound,
    expectedTypes,
    fileCount: files.length,
    platformFileCount: platformFiles.length,
  };
}

/**
 * Cross-verify LLM's claimed characterization against objective PR signals.
 */
function verifyCharacterization(claimed, observed) {
  const errors = [];
  const warnings = [];

  if (!claimed || typeof claimed !== 'object') {
    errors.push({
      code: 'E_MISSING_CHARACTERIZATION',
      message: 'Missing characterization object in review draft.',
    });
    return {
      valid: false,
      effectiveType: observed.expectedTypes[0] || 'core_feature',
      errors,
      warnings,
    };
  }

  if (!PR_TYPES.includes(claimed.type)) {
    errors.push({
      code: 'E_INVALID_PR_TYPE',
      message: `Invalid characterization.type "${claimed.type}". Expected one of: ${PR_TYPES.join(', ')}.`,
    });
  }

  if (!claimed.summary || !String(claimed.summary).trim()) {
    errors.push({
      code: 'E_MISSING_SUMMARY',
      message: 'characterization.summary must be a non-empty string.',
    });
  }

  if (!Array.isArray(claimed.focusAreas) || claimed.focusAreas.length === 0) {
    errors.push({
      code: 'E_MISSING_FOCUS_AREAS',
      message:
        'characterization.focusAreas must contain at least 1 focus area.',
    });
  }

  if (
    PR_TYPES.includes(claimed.type) &&
    !observed.expectedTypes.includes(claimed.type)
  ) {
    errors.push({
      code: 'E_CHARACTERIZATION_MISMATCH',
      message: `Claimed PR type "${claimed.type}" contradicts observed PR signals (expected: ${observed.expectedTypes.join(' | ')}).`,
    });
  }

  if (
    observed.hasCrossPlatformSignals &&
    claimed.type !== 'cross_platform_migration' &&
    !observed.isRevert
  ) {
    warnings.push({
      code: 'W_CROSS_PLATFORM_SIGNALS_PRESENT',
      message:
        'Observed cross-platform files/symbols; cross-platform alignment boost enabled automatically.',
    });
  }

  let effectiveType = observed.expectedTypes[0] || 'core_feature';
  if (observed.isRevert) {
    effectiveType = 'revert';
  } else if (observed.isDepsOrCi) {
    effectiveType = 'deps_or_ci';
  } else if (PR_TYPES.includes(claimed.type)) {
    effectiveType = claimed.type;
  }

  return {
    valid: errors.length === 0,
    effectiveType,
    errors,
    warnings,
  };
}

/**
 * Compute deterministic SignalScore (0-100) for a single candidate finding.
 */
function scoreFinding(finding, options = {}) {
  const {
    effectiveType = 'core_feature',
    observed = {},
    fileHunks = {},
    hasDiff = false,
    repoRoot = null,
    existingThreads = [],
    mode = 'soft',
  } = options;

  const title = String(finding.title || '').trim();
  const problem = String(finding.problem || '').trim();
  const combinedText = `${title}\n${problem}`;
  const file = normalizePath(finding.file);
  const line =
    typeof finding.line === 'number' && Number.isFinite(finding.line)
      ? finding.line
      : null;
  const severity = SEVERITIES.has(finding.severity) ? finding.severity : 'P2';

  // Anti-gaming reclassification: detect a11y/motion nitpicks even if labeled edge_case
  let effectiveCategory = FINDING_CATEGORIES.includes(finding.category)
    ? finding.category
    : 'edge_case';
  const reclassifiedReasons = [];

  if (
    A11Y_OR_MOTION_RE.test(combinedText) &&
    effectiveCategory !== 'a11y_or_motion' &&
    !['security', 'funds_loss', 'crash'].includes(effectiveCategory)
  ) {
    effectiveCategory = 'a11y_or_motion';
    reclassifiedReasons.push('reclassified_to_a11y_or_motion');
  }

  let baseImpact = BASE_IMPACT[effectiveCategory] ?? 18;
  const typeMatrix =
    TYPE_ALIGNMENT_MATRIX[effectiveType] || TYPE_ALIGNMENT_MATRIX.core_feature;
  let typeAlignment = typeMatrix[effectiveCategory] ?? 0.5;

  // Dynamic signal-based alignment adjustments
  if (observed.isA11yTarget && effectiveCategory === 'a11y_or_motion') {
    baseImpact = 30;
    typeAlignment = 1.5;
  }
  if (
    observed.hasCrossPlatformSignals &&
    !observed.isRevert &&
    [
      'cross_platform_divergence',
      'half_migration',
      'code_duplication',
    ].includes(effectiveCategory)
  ) {
    typeAlignment = Math.max(typeAlignment, 1.4);
  }
  if (
    observed.hasSecurityCriticalSignals &&
    ['security', 'funds_loss', 'data_corruption'].includes(effectiveCategory)
  ) {
    typeAlignment = Math.max(typeAlignment, 1.4);
  }

  // Evidence verification (0-40)
  const evidence = finding.evidence || {};
  let inDiffVerified = Boolean(evidence.inDiff);
  if (hasDiff) {
    inDiffVerified = isLineInDiffHunks(fileHunks, file, line);
  }

  const isSpeculative = SPECULATIVE_TITLE_RE.test(title);
  const hasConcreteProof =
    !isSpeculative &&
    (Boolean(String(evidence.executionPath || '').trim()) ||
      problem.length >= 24);

  const verifiedReuseTargets = [];
  const missingReuseTargets = [];
  const rawTargets = Array.isArray(evidence.existingReuseTargets)
    ? evidence.existingReuseTargets
    : [];
  for (const raw of rawTargets) {
    const clean = stripLineSuffix(raw);
    if (clean) {
      if (repoRoot) {
        const fullPath = path.join(repoRoot, clean);
        if (fs.existsSync(fullPath)) {
          verifiedReuseTargets.push(raw);
        } else {
          missingReuseTargets.push(raw);
        }
      } else {
        verifiedReuseTargets.push(raw);
      }
    }
  }

  let evidenceScore = 0;
  const evidenceNotes = [];
  if (inDiffVerified) {
    evidenceScore += 15;
    evidenceNotes.push('in_diff(+15)');
  }
  if (hasConcreteProof) {
    evidenceScore += 15;
    evidenceNotes.push('concrete_proof(+15)');
  }
  if (verifiedReuseTargets.length > 0) {
    evidenceScore += 10;
    evidenceNotes.push(`verified_refs:${verifiedReuseTargets.length}(+10)`);
  }

  // Noise & spiral penalties
  let noisePenalty = 0;
  const penaltyReasons = [];

  if (isSpeculative) {
    noisePenalty += 25;
    penaltyReasons.push('speculative_question(-25)');
  }

  const isPreExisting =
    Boolean(finding.isPreExisting) || (hasDiff && !inDiffVerified);
  if (isPreExisting) {
    noisePenalty += 30;
    penaltyReasons.push('pre_existing_or_out_of_diff(-30)');
  }

  if (observed.isFollowUpRound && severity === 'P2') {
    noisePenalty += 35;
    penaltyReasons.push('follow_up_round_p2_spiral(-35)');
  }

  if (missingReuseTargets.length > 0 && verifiedReuseTargets.length === 0) {
    noisePenalty += 15;
    penaltyReasons.push('unverified_reuse_target(-15)');
  }

  const normTitle = normalizeTitleForDedup(title);
  const isDuplicateThread = existingThreads.some((th) => {
    const sameFile = normalizePath(th.path) === file;
    const thTitle = normalizeTitleForDedup(th.title || th.body || '');
    return sameFile && normTitle.length > 8 && thTitle.includes(normTitle);
  });
  if (isDuplicateThread) {
    noisePenalty += 40;
    penaltyReasons.push('duplicate_existing_thread(-40)');
  }

  const weightedImpact = Number((baseImpact * typeAlignment).toFixed(2));
  const rawScore = weightedImpact + evidenceScore - noisePenalty;
  const signalScore = clamp(Math.round(rawScore), 0, 100);

  const publishThreshold =
    severity === 'P0'
      ? THRESHOLDS.PUBLISH_P0_MIN_SCORE
      : THRESHOLDS.PUBLISH_MIN_SCORE;

  let preliminaryDecision = 'DROP';
  if (signalScore >= publishThreshold && typeAlignment > 0) {
    preliminaryDecision = 'PUBLISH';
  } else if (signalScore >= THRESHOLDS.SUMMARY_MIN_SCORE && typeAlignment > 0) {
    preliminaryDecision = 'SUMMARY_ONLY';
  }

  // High-risk P0 safety valve in pilot modes (shadow/soft): never silently drop high-risk P0s
  let safetyValveApplied = false;
  if (
    preliminaryDecision === 'DROP' &&
    mode !== 'strict' &&
    severity === 'P0' &&
    HIGH_RISK_SAFETY_CATEGORIES.has(effectiveCategory)
  ) {
    preliminaryDecision = 'SUMMARY_ONLY';
    safetyValveApplied = true;
    penaltyReasons.push('safety_valve_p0_preserved');
  }

  return {
    ...finding,
    file,
    line,
    severity,
    effectiveCategory,
    scoreBreakdown: {
      baseImpact,
      typeAlignment,
      weightedImpact,
      evidenceScore,
      evidenceNotes,
      noisePenalty,
      penaltyReasons,
      reclassifiedReasons,
      verifiedReuseTargets,
      missingReuseTargets,
      safetyValveApplied,
    },
    signalScore,
    decision: preliminaryDecision,
  };
}

/**
 * Evaluate a full review draft against PR context and diff.
 */
function evaluateReview(draft, prContext = {}, options = {}) {
  const mode = GATE_MODES.has(options.mode) ? options.mode : 'soft';
  const observed = extractObservedProfile(prContext);
  const characterizationCheck = verifyCharacterization(
    draft.characterization,
    observed,
  );
  const diffText = String(prContext.diffText || '');
  const hasDiff = diffText.trim().length > 0;
  const fileHunks = hasDiff ? parseUnifiedDiffHunks(diffText) : {};

  const rawFindings = Array.isArray(draft.findings) ? draft.findings : [];
  const scored = rawFindings.map((f) =>
    scoreFinding(f, {
      effectiveType: characterizationCheck.effectiveType,
      observed,
      fileHunks,
      hasDiff,
      repoRoot: options.repoRoot || null,
      existingThreads: Array.isArray(prContext.existingThreads)
        ? prContext.existingThreads
        : [],
      mode,
    }),
  );

  // Sort by severity rank (P0 > P1 > P2), then signalScore descending
  const sevRank = { P0: 0, P1: 1, P2: 2 };
  scored.sort((a, b) => {
    if (sevRank[a.severity] !== sevRank[b.severity]) {
      return sevRank[a.severity] - sevRank[b.severity];
    }
    return b.signalScore - a.signalScore;
  });

  // Apply hard inline comment cap (keep all P0s; cap total at MAX_INLINE_COMMENTS unless all are P0)
  let publishCount = 0;
  for (const item of scored) {
    if (item.decision === 'PUBLISH') {
      if (
        publishCount < THRESHOLDS.MAX_INLINE_COMMENTS ||
        item.severity === 'P0'
      ) {
        publishCount += 1;
      } else {
        item.decision = 'SUMMARY_ONLY';
        item.scoreBreakdown.penaltyReasons.push('capped_over_max_inline_limit');
      }
    }
  }

  const published = scored.filter((f) => f.decision === 'PUBLISH');
  const summaryOnly = scored.filter((f) => f.decision === 'SUMMARY_ONLY');
  const dropped = scored.filter((f) => f.decision === 'DROP');

  const hasP0 = published.some((f) => f.severity === 'P0');
  const hasHighP1 = published.some(
    (f) =>
      f.severity === 'P1' &&
      f.signalScore >= THRESHOLDS.REQUEST_CHANGES_P1_MIN_SCORE,
  );

  let verdict = 'APPROVE';
  if (hasP0 || hasHighP1) {
    verdict = 'REQUEST_CHANGES';
  } else if (published.length > 0) {
    verdict = 'COMMENT';
  }

  return {
    mode,
    status: 'ok',
    gateErrors: characterizationCheck.valid ? [] : characterizationCheck.errors,
    prNumber: draft.prNumber ?? prContext.prNumber ?? null,
    headSha: draft.headSha ?? prContext.headSha ?? null,
    observedProfile: observed,
    characterizationCheck,
    claimedCharacterization: draft.characterization || null,
    verdict,
    counts: {
      totalCandidates: scored.length,
      published: published.length,
      summaryOnly: summaryOnly.length,
      dropped: dropped.length,
    },
    published,
    summaryOnly,
    dropped,
    allScored: scored,
  };
}

function buildPublishPayload(result) {
  // In shadow mode, do not suppress any candidate comments; attach gate decisions for comparison
  const itemsToPublish =
    result.mode === 'shadow'
      ? result.allScored || result.published
      : result.published;
  return {
    mode: result.mode || 'soft',
    status: result.status || 'ok',
    prNumber: result.prNumber,
    headSha: result.headSha,
    verdict: result.verdict,
    summaryCommentBody: renderMarkdownReport(result),
    comments: itemsToPublish.map((f) => ({
      path: f.file,
      line: f.line,
      side: 'RIGHT',
      severity: f.severity,
      signalScore: f.signalScore,
      gateDecision: f.decision,
      body: [
        `${f.severity}: [${f.title}] (SignalScore: ${f.signalScore}/100)`,
        '',
        `**Problem**: ${f.problem}`,
        f.impact ? `**Impact**: ${f.impact}` : null,
        f.suggestedFix ? `**Suggested Fix**: ${f.suggestedFix}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    })),
  };
}

function renderMarkdownReport(result) {
  const verdictLabel = {
    APPROVE: '✅ APPROVE（无高信噪比阻塞问题）',
    COMMENT: '⚠️ COMMENT（建议修改后合入）',
    REQUEST_CHANGES: '❌ REQUEST_CHANGES（存在高分 P0/P1 需修复）',
  }[result.verdict];

  const lines = [];
  lines.push(
    `# PR ${result.prNumber ? `#${result.prNumber}` : ''} 量化门禁审查报告`,
  );
  lines.push('');
  lines.push('## 审查概要');
  lines.push(
    `- **PR 定性（已核验）**: \`${result.characterizationCheck.effectiveType}\` ${result.characterizationCheck.valid ? '✅' : '⚠️ (已按客观信号校验)'}`,
  );
  if (result.claimedCharacterization?.summary) {
    lines.push(`- **变更意图**: ${result.claimedCharacterization.summary}`);
  }
  lines.push(
    `- **门禁筛选结果**: 候选 ${result.counts.totalCandidates} 条 → **发布 ${result.counts.published} 条** / 汇总参考 ${result.counts.summaryOnly} 条 / 自动丢弃 ${result.counts.dropped} 条`,
  );
  lines.push(`- **最终结论**: ${verdictLabel}`);
  lines.push('');

  if (result.published.length === 0) {
    lines.push('## 发布发现');
    lines.push(
      'LGTM — 未发现达到发布阈值的高信噪比问题，本次发布 0 条行内评论。',
    );
    lines.push('');
  } else {
    lines.push('## 发布发现（PUBLISH）');
    lines.push('');
    lines.push('| 优先级 | SignalScore | 类别 | 文件 | 标题 | 分数拆解 |');
    lines.push('|---|---:|---|---|---|---|');
    for (const f of result.published) {
      const b = f.scoreBreakdown;
      const loc = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
      const breakdown = `${b.baseImpact}×${b.typeAlignment} +${b.evidenceScore} -${b.noisePenalty}`;
      lines.push(
        `| **${f.severity}** | **${f.signalScore}** | \`${f.effectiveCategory}\` | ${loc} | ${f.title} | \`${breakdown}\` |`,
      );
    }
    lines.push('');
  }

  const filteredCount = result.summaryOnly.length + result.dropped.length;
  if (filteredCount > 0) {
    lines.push('<details>');
    lines.push(
      `<summary>🔍 门禁未发内联评论明细（共 ${filteredCount} 条：次要参考 ${result.summaryOnly.length} 条 / 自动过滤 ${result.dropped.length} 条，点击展开核查）</summary>`,
    );
    lines.push('');
    if (result.summaryOnly.length > 0) {
      lines.push('### 次要参考（SUMMARY_ONLY）');
      for (const f of result.summaryOnly) {
        const valve = f.scoreBreakdown.safetyValveApplied
          ? ' ⚠️ `safety_valve_p0_preserved`'
          : '';
        lines.push(
          `- [${f.severity}][Score ${f.signalScore}] \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${f.title}${valve}`,
        );
      }
      lines.push('');
    }
    if (result.dropped.length > 0) {
      lines.push('### 自动过滤（DROPPED）');
      for (const f of result.dropped) {
        const reasons = [
          ...f.scoreBreakdown.reclassifiedReasons,
          ...f.scoreBreakdown.penaltyReasons,
        ];
        lines.push(
          `- [Score ${f.signalScore}] \`${f.effectiveCategory}\` \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${f.title}${reasons.length ? ` (${reasons.join(', ')})` : ''}`,
        );
      }
      lines.push('');
    }
    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n');
}

function parseCliArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function runCli(argv) {
  const args = parseCliArgs(argv);
  const cmd = args._[0] || 'evaluate';
  if (cmd !== 'evaluate' || !args.input) {
    process.stderr.write(
      'Usage: node development/scripts/review-score-gate.js evaluate --input <draft.json> [--mode shadow|soft|strict] [--context <pr-context.json>] [--diff <pr.diff>] [--repo <path>] [--out-json <validated.json>] [--out-md <report.md>] [--strict]\n',
    );
    process.exit(1);
  }

  let mode = 'soft';
  if (args.strict) {
    mode = 'strict';
  } else if (GATE_MODES.has(args.mode)) {
    mode = args.mode;
  }

  const rawDraftText = fs.readFileSync(args.input, 'utf8');
  const parsed = parseReviewDraftSafely(rawDraftText);

  if (!parsed.ok) {
    const fallbackResult = {
      mode,
      status: 'fallback_passthrough',
      gateErrors: [{ code: 'E_INVALID_DRAFT_JSON', message: parsed.error }],
      rawDraftPreview: rawDraftText.slice(0, 500),
    };
    if (args['out-json']) {
      fs.writeFileSync(
        args['out-json'],
        JSON.stringify(fallbackResult, null, 2),
      );
    }
    if (args['out-md']) {
      fs.writeFileSync(
        args['out-md'],
        `> ⚠️ Review score gate entered \`fallback_passthrough\` (${parsed.error}). Pipeline was not blocked.\n`,
      );
    }
    if (mode === 'strict') {
      process.stderr.write(`Draft JSON parse failed: ${parsed.error}\n`);
      process.exit(2);
    }
    return;
  }

  const draft = parsed.draft;
  const prContext = args.context
    ? JSON.parse(fs.readFileSync(args.context, 'utf8'))
    : draft.prContext || {};
  if (args.diff) {
    prContext.diffText = fs.readFileSync(args.diff, 'utf8');
  }

  const result = evaluateReview(draft, prContext, {
    repoRoot: args.repo || process.cwd(),
    mode,
  });
  const payload = buildPublishPayload(result);
  const reportMd = renderMarkdownReport(result);

  if (args['out-json']) {
    fs.writeFileSync(
      args['out-json'],
      JSON.stringify({ ...result, publishPayload: payload }, null, 2),
    );
  }
  if (args['out-md']) {
    fs.writeFileSync(args['out-md'], reportMd);
  }

  if (!args['out-md'] && !args['out-json']) {
    process.stdout.write(`${reportMd}\n`);
  }

  if (mode === 'strict' && !result.characterizationCheck.valid) {
    process.stderr.write(
      `Characterization check failed:\n${JSON.stringify(result.characterizationCheck.errors, null, 2)}\n`,
    );
    process.exit(2);
  }
}

if (require.main === module) {
  runCli(process.argv.slice(2));
}

module.exports = {
  PR_TYPES,
  GATE_MODES,
  FINDING_CATEGORIES,
  BASE_IMPACT,
  TYPE_ALIGNMENT_MATRIX,
  THRESHOLDS,
  parseReviewDraftSafely,
  parseUnifiedDiffHunks,
  extractObservedProfile,
  verifyCharacterization,
  scoreFinding,
  evaluateReview,
  buildPublishPayload,
  renderMarkdownReport,
};
