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
  'general',
];

const SEVERITIES = new Set(['P0', 'P1', 'P2']);

const GATE_MODES = new Set(['shadow', 'soft', 'strict']);

const HIGH_RISK_SAFETY_CATEGORIES = new Set([
  'security',
  'funds_loss',
  'crash',
  'data_corruption',
  'concurrency_race',
  'half_migration',
  'cross_platform_divergence',
]);

const RECLASSIFY_EXEMPT_CATEGORIES = new Set([
  'security',
  'funds_loss',
  'crash',
  'build_registry',
  'data_corruption',
  'concurrency_race',
  'runtime_boundary',
]);

const BASE_IMPACT = {
  security: 44,
  funds_loss: 44,
  crash: 44,
  build_registry: 44,
  cross_platform_divergence: 36,
  half_migration: 36,
  code_duplication: 36,
  concurrency_race: 36,
  data_corruption: 36,
  runtime_boundary: 34,
  memory_leak: 34,
  error_handling: 30,
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
    data_corruption: 1.2,
    half_migration: 1.1,
    concurrency_race: 0.9,
    runtime_boundary: 0.9,
    memory_leak: 0.8,
    cross_platform_divergence: 0.6,
    error_handling: 0.5,
    performance: 0.5,
    code_duplication: 0.0,
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
    data_corruption: 1.1,
    runtime_boundary: 1.0,
    concurrency_race: 0.7,
    memory_leak: 0.6,
    error_handling: 0.5,
    performance: 0.4,
    cross_platform_divergence: 0.0,
    half_migration: 0.0,
    code_duplication: 0.0,
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
    cross_platform_divergence: 1.4,
    half_migration: 1.4,
    code_duplication: 1.4,
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
    data_corruption: 1.3,
    concurrency_race: 1.3,
    runtime_boundary: 1.2,
    memory_leak: 1.2,
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
    memory_leak: 1.2,
    error_handling: 1.0,
    cross_platform_divergence: 1.1,
    half_migration: 0.9,
    code_duplication: 0.9,
    performance: 0.8,
    edge_case: 0.6,
    a11y_or_motion: 0.2,
    ui_polish: 0.3,
    style_nit: 0.0,
  },
  general: {
    security: 1.3,
    funds_loss: 1.3,
    crash: 1.2,
    build_registry: 1.2,
    data_corruption: 1.2,
    concurrency_race: 1.2,
    runtime_boundary: 1.2,
    memory_leak: 1.1,
    error_handling: 0.9,
    cross_platform_divergence: 1.0,
    half_migration: 0.9,
    code_duplication: 1.0,
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
  REQUEST_CHANGES_P1_MIN_SCORE: 78,
};

const A11Y_OR_MOTION_RE =
  /\b(voiceover|talkback|screen\s*readers?|assistive\s+technolog|accessibilitylabel|accessibilityrole|aria-[a-z]+|contentdescription|spoken\s+(?:value|text)|reduce[d]?\s+motion|keyboard\s+(?:navigation|focus|operable|accessible)|focus\s+(?:ring|indicator|frame)|tab\s*order|tabindex|separating\s+hinge|accessible\s+name)\b|(旁白|读屏|屏幕阅读器|无障碍|辅助功能|减弱动态效果|减少动态效果|键盘导航|焦点框|折叠屏铰链)/i;

const SPECULATIVE_TITLE_RE =
  /^\s*(?:P[0-2]\s*:\s*)?\[?\s*(?:(?:confirm|verify|check\s+whether|check\s+if|ensure\s+that|double[- ]check)\b|确认是否|验证是否|检查是否|请确认|核实)/i;

const DEPS_OR_CI_FILE_RE =
  /(^|\/)(package\.json|yarn\.lock|Podfile\.lock|Gemfile\.lock|Cargo\.lock|renovate\.json|Dockerfile|\.yarnrc\.yml|\.github\/workflows\/|\.github\/actions\/)|\.podspec$/i;

const DEPS_OR_CI_TITLE_RE =
  /^\s*(?:(?:chore|build)\(deps[^)]*\)|ci(?:\([^)]+\))?):/i;

const PLATFORM_SUFFIX_RE =
  /\.(native|ios|android|web|desktop|ext)\.(ts|tsx|js|jsx)$/i;

const CROSS_PLATFORM_MIGRATION_HINT_RE =
  /(NativeList|AppPager|CollapsiblePagerView|Tabs\.Container|legacy[A-Z]|module-id-registry\.json)/;

const SECURITY_CRITICAL_FILE_RE =
  /(^|\/)(vault|signing|crypto|auth|manifest|keyring|hardware|bundle-registry|dbs\/local\/consts\.ts)/i;

const A11Y_PR_HINT_RE =
  /\b(a11y|accessibility|voiceover|talkback|screen\s*reader|wcag)\b|(无障碍|旁白|读屏)/i;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  let clean = filePath.trim();
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1);
  }
  return clean
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

function escapeMdCell(text) {
  return String(text || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n+/g, ' ')
    .trim();
}

/**
 * Parse both plain ('high'|'medium'|'low') and SKILL.md emoji ('🔵 High'|'🟠 Medium'|'⚪ Low') confidence labels.
 * Missing or unknown confidence defaults to 'low' (never silently upgraded to 'high').
 */
function parseConfidence(raw) {
  if (typeof raw !== 'string') return 'low';
  const norm = raw.toLowerCase();
  if (norm.includes('high') || norm.includes('🔵')) return 'high';
  if (norm.includes('medium') || norm.includes('🟠')) return 'medium';
  if (norm.includes('low') || norm.includes('⚪')) return 'low';
  return 'low';
}

/**
 * Safely parse LLM JSON output, tolerating markdown code fences or surrounding prose.
 * Scans all fenced blocks (prioritizing ```json) and rejects non-plain-object JSON (e.g. null, arrays).
 */
function parseReviewDraftSafely(rawText) {
  if (isPlainObject(rawText)) {
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
    const direct = JSON.parse(text);
    if (!isPlainObject(direct)) {
      return {
        ok: false,
        draft: null,
        error: 'Review draft JSON must be an object.',
        recoveredFromFence: false,
      };
    }
    return { ok: true, draft: direct, error: null, recoveredFromFence: false };
  } catch {
    // Scan all fenced blocks, prioritizing ```json blocks first
    const fenceRe = /```(json)?\s*([\s\S]*?)```/gi;
    const jsonBlocks = [];
    const otherBlocks = [];
    let match = fenceRe.exec(text);
    while (match !== null) {
      if (match[1]) {
        jsonBlocks.push(match[2].trim());
      } else {
        otherBlocks.push(match[2].trim());
      }
      match = fenceRe.exec(text);
    }

    for (const candidate of [...jsonBlocks, ...otherBlocks]) {
      try {
        const parsed = JSON.parse(candidate);
        if (isPlainObject(parsed)) {
          return {
            ok: true,
            draft: parsed,
            error: null,
            recoveredFromFence: true,
          };
        }
      } catch {
        // continue trying remaining blocks
      }
    }

    // Last resort: extract outermost { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1));
        if (isPlainObject(parsed)) {
          return {
            ok: true,
            draft: parsed,
            error: null,
            recoveredFromFence: true,
          };
        }
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
 * Tracks diff header state so added lines starting with '++ ' are never parsed as file headers,
 * and skips pure-deletion hunks (count === 0).
 */
function parseUnifiedDiffHunks(diffText) {
  const fileHunks = {};
  if (!diffText || typeof diffText !== 'string') {
    return fileHunks;
  }
  let currentFile = null;
  let expectingPlusHeader = false;
  const lines = diffText.split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      currentFile = null;
      expectingPlusHeader = false;
    } else if (line.startsWith('--- ')) {
      expectingPlusHeader = true;
    } else if (expectingPlusHeader && line.startsWith('+++ ')) {
      expectingPlusHeader = false;
      const candidate = line.slice(4).trim();
      if (candidate === '/dev/null') {
        currentFile = null;
      } else {
        currentFile = normalizePath(candidate);
        if (!fileHunks[currentFile]) {
          fileHunks[currentFile] = [];
        }
      }
    } else if (currentFile && line.startsWith('@@ ')) {
      const hunkMatch = line.match(
        /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/,
      );
      if (hunkMatch) {
        const start = Number(hunkMatch[1]);
        const count = hunkMatch[2] === undefined ? 1 : Number(hunkMatch[2]);
        if (count > 0) {
          fileHunks[currentFile].push({ start, end: start + count - 1 });
        }
      }
    }
  }
  return fileHunks;
}

function isLineInDiffHunks(fileHunks, filePath, lineNumber) {
  const norm = normalizePath(filePath);
  const hunks = fileHunks[norm];
  if (!hunks || hunks.length === 0) return false;
  if (
    typeof lineNumber !== 'number' ||
    !Number.isFinite(lineNumber) ||
    lineNumber < 1
  ) {
    return false;
  }
  return hunks.some((h) => lineNumber >= h.start && lineNumber <= h.end);
}

/**
 * Verify a relative file path exists as a regular file strictly inside repoRoot.
 */
function isVerifiedRepoFile(repoRoot, rawTarget) {
  if (!repoRoot) return false;
  const clean = stripLineSuffix(rawTarget);
  if (!clean || path.isAbsolute(clean)) return false;
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedFile = path.resolve(resolvedRoot, clean);
  if (
    resolvedFile !== resolvedRoot &&
    !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    return false;
  }
  try {
    return fs.statSync(resolvedFile).isFile();
  } catch {
    return false;
  }
}

/**
 * Extract an objective PR profile from PR metadata and diff signals.
 * Supports both plain string arrays and `gh pr view --json` object arrays ({name}, {path}).
 */
function extractObservedProfile(prContext = {}) {
  const title = String(prContext.title || '');
  const body = String(prContext.body || '');
  const labels = Array.isArray(prContext.labels)
    ? prContext.labels
        .map((l) => {
          if (typeof l === 'string') return l;
          return l && l.name ? String(l.name) : '';
        })
        .filter(Boolean)
    : [];
  const files = Array.isArray(prContext.files)
    ? prContext.files
        .map((f) => {
          const raw = typeof f === 'string' ? f : String((f && f.path) || '');
          return normalizePath(raw);
        })
        .filter(Boolean)
    : [];
  const diffText = String(prContext.diffText || '');
  const existingAutoThreadCount = Number(
    prContext.existingAutoThreadCount || 0,
  );
  const reviewRound = Number(prContext.reviewRound || 1);

  const isRevert =
    /^\s*revert(\([^)]+\))?:/i.test(title) ||
    /^\s*revert\s+"/i.test(title) ||
    /^this reverts commit\b/im.test(body);

  const depsOrCiFiles = files.filter((f) => DEPS_OR_CI_FILE_RE.test(f));
  const isStrictlyDepsOrCi =
    !isRevert && files.length > 0 && depsOrCiFiles.length === files.length;
  const isDepsOrCiTitle = !isRevert && DEPS_OR_CI_TITLE_RE.test(title);

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
  } else if (isStrictlyDepsOrCi) {
    expectedTypes = ['deps_or_ci'];
  } else if (isDepsOrCiTitle) {
    expectedTypes = ['deps_or_ci', 'core_feature', 'targeted_bugfix'];
  } else if (hasCrossPlatformSignals) {
    expectedTypes = [
      'cross_platform_migration',
      'core_feature',
      'targeted_bugfix',
    ];
  } else if (isFixTitle) {
    expectedTypes = ['targeted_bugfix', 'core_feature'];
  } else if (files.length === 0 && !title.trim()) {
    expectedTypes = ['general', 'core_feature', 'targeted_bugfix'];
  } else {
    expectedTypes = ['core_feature', 'targeted_bugfix', 'general'];
  }

  return {
    isRevert,
    isDepsOrCi: isStrictlyDepsOrCi,
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

  if (!isPlainObject(claimed)) {
    errors.push({
      code: 'E_MISSING_CHARACTERIZATION',
      message: 'Missing characterization object in review draft.',
    });
    return {
      valid: false,
      effectiveType: observed.expectedTypes[0] || 'general',
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

  let effectiveType = observed.expectedTypes[0] || 'general';
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
  const anchorFile = normalizePath(finding.anchorFile || finding.file);
  const anchorLine =
    typeof finding.anchorLine === 'number' &&
    Number.isFinite(finding.anchorLine)
      ? finding.anchorLine
      : line;

  const severity = SEVERITIES.has(finding.severity) ? finding.severity : 'P2';
  const confidence = parseConfidence(finding.confidence);

  // Anti-gaming reclassification: detect a11y/motion nitpicks unless category is core safety/runtime
  let effectiveCategory = FINDING_CATEGORIES.includes(finding.category)
    ? finding.category
    : 'edge_case';
  const reclassifiedReasons = [];

  if (
    A11Y_OR_MOTION_RE.test(combinedText) &&
    effectiveCategory !== 'a11y_or_motion' &&
    !RECLASSIFY_EXEMPT_CATEGORIES.has(effectiveCategory)
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
    baseImpact = 32;
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
  const evidence = isPlainObject(finding.evidence) ? finding.evidence : {};
  const hasAnchorLine =
    typeof anchorLine === 'number' &&
    Number.isFinite(anchorLine) &&
    anchorLine >= 1;
  let inDiffVerified = Boolean(evidence.inDiff) && hasAnchorLine;
  if (hasDiff) {
    inDiffVerified = isLineInDiffHunks(fileHunks, anchorFile, anchorLine);
  }
  const hasValidInlineAnchor =
    Boolean(anchorFile) && hasAnchorLine && inDiffVerified;

  const isSpeculative = SPECULATIVE_TITLE_RE.test(title);
  const hasConcreteProof =
    !isSpeculative &&
    (Boolean(String(evidence.executionPath || '').trim()) ||
      Boolean(String(evidence.reproduction || '').trim()));

  // Verify referenced repository files (codeReferences or existingReuseTargets) strictly inside repoRoot
  const verifiedCodeRefs = [];
  const missingCodeRefs = [];
  const rawRefs = [
    ...(Array.isArray(evidence.existingReuseTargets)
      ? evidence.existingReuseTargets
      : []),
    ...(Array.isArray(evidence.codeReferences) ? evidence.codeReferences : []),
  ];
  for (const raw of rawRefs) {
    if (isVerifiedRepoFile(repoRoot, raw)) {
      verifiedCodeRefs.push(raw);
    } else if (raw && typeof raw === 'string') {
      missingCodeRefs.push(raw);
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
  if (verifiedCodeRefs.length > 0) {
    evidenceScore += 10;
    evidenceNotes.push(`verified_refs:${verifiedCodeRefs.length}(+10)`);
  }

  // Noise & spiral penalties
  let noisePenalty = 0;
  const penaltyReasons = [];

  if (isSpeculative) {
    noisePenalty += 25;
    penaltyReasons.push('speculative_question(-25)');
  }

  // Only penalize pre-existing issues when explicitly marked pre-existing, OR out-of-diff without proof linking to this diff
  const isPreExisting =
    finding.isPreExisting === true ||
    (finding.isPreExisting !== false &&
      hasDiff &&
      !inDiffVerified &&
      !hasConcreteProof);
  if (isPreExisting) {
    noisePenalty += 30;
    penaltyReasons.push('pre_existing(-30)');
  }

  if (observed.isFollowUpRound && severity === 'P2') {
    noisePenalty += 35;
    penaltyReasons.push('follow_up_round_p2_spiral(-35)');
  }

  if (repoRoot && missingCodeRefs.length > 0 && verifiedCodeRefs.length === 0) {
    noisePenalty += 15;
    penaltyReasons.push('unverified_code_ref(-15)');
  }

  // Duplicate unresolved thread handling: NEVER penalize score or drop blockers; route to REPLY_THREAD
  const normTitle = normalizeTitleForDedup(title);
  const minDedupLen = /[\u4e00-\u9fff]/.test(normTitle) ? 4 : 8;
  const matchedThread = existingThreads.find((th) => {
    if (th.isResolved) return false;
    if (finding.existingThreadId && th.id === finding.existingThreadId) {
      return true;
    }
    const sameFile = normalizePath(th.path) === file;
    const thTitle = normalizeTitleForDedup(th.title || th.body || '');
    return (
      sameFile &&
      normTitle.length >= minDedupLen &&
      (thTitle.includes(normTitle) || normTitle.includes(thTitle))
    );
  });
  const duplicateOfThreadId = matchedThread
    ? matchedThread.id || 'matched'
    : null;

  const weightedImpact = Number((baseImpact * typeAlignment).toFixed(2));
  const rawScore = weightedImpact + evidenceScore - noisePenalty;
  const signalScore = clamp(Math.round(rawScore), 0, 100);

  const publishThreshold =
    severity === 'P0'
      ? THRESHOLDS.PUBLISH_P0_MIN_SCORE
      : THRESHOLDS.PUBLISH_MIN_SCORE;

  // Inline publication eligibility: P0 (any confidence) or P1 with high confidence
  const meetsInlineEligibility =
    severity === 'P0' || (severity === 'P1' && confidence === 'high');

  let preliminaryDecision = 'DROP';
  if (
    !isSpeculative &&
    meetsInlineEligibility &&
    (hasValidInlineAnchor || Boolean(duplicateOfThreadId)) &&
    signalScore >= publishThreshold &&
    typeAlignment > 0
  ) {
    preliminaryDecision = 'PUBLISH';
  } else if (
    !isSpeculative &&
    (signalScore >= THRESHOLDS.SUMMARY_MIN_SCORE ||
      (meetsInlineEligibility &&
        !hasValidInlineAnchor &&
        signalScore >= publishThreshold)) &&
    typeAlignment > 0
  ) {
    preliminaryDecision = 'SUMMARY_ONLY';
    if (meetsInlineEligibility && !hasValidInlineAnchor) {
      penaltyReasons.push('missing_valid_diff_anchor');
    }
  }

  // High-risk P0 safety valve in pilot modes (shadow/soft): preserve non-speculative high-risk P0s
  let safetyValveApplied = false;
  if (
    preliminaryDecision === 'DROP' &&
    mode !== 'strict' &&
    !isSpeculative &&
    severity === 'P0' &&
    HIGH_RISK_SAFETY_CATEGORIES.has(effectiveCategory)
  ) {
    preliminaryDecision = 'SUMMARY_ONLY';
    safetyValveApplied = true;
    penaltyReasons.push('safety_valve_p0_preserved');
  }

  const publishAction = duplicateOfThreadId ? 'REPLY_THREAD' : 'NEW_THREAD';

  return {
    ...finding,
    file,
    line,
    anchorFile,
    anchorLine,
    severity,
    confidence,
    effectiveCategory,
    publishAction,
    duplicateOfThreadId,
    scoreBreakdown: {
      baseImpact,
      typeAlignment,
      weightedImpact,
      evidenceScore,
      evidenceNotes,
      noisePenalty,
      penaltyReasons,
      reclassifiedReasons,
      verifiedCodeRefs,
      missingCodeRefs,
      hasValidInlineAnchor,
      meetsInlineEligibility,
      isSpeculative,
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
  const inputErrors = [];

  if (!isPlainObject(draft)) {
    inputErrors.push({
      code: 'E_INVALID_DRAFT_OBJECT',
      message: 'Review draft must be a plain JSON object.',
    });
  }
  const safeDraft = isPlainObject(draft) ? draft : {};

  // Independently collected prContext is the source of truth for PR identity
  const resolvedPrNumber = prContext.prNumber ?? safeDraft.prNumber ?? null;
  const resolvedHeadSha =
    prContext.headSha ?? prContext.headRefOid ?? safeDraft.headSha ?? null;
  if (
    prContext.prNumber !== undefined &&
    safeDraft.prNumber !== undefined &&
    Number(prContext.prNumber) !== Number(safeDraft.prNumber)
  ) {
    inputErrors.push({
      code: 'E_CONTEXT_MISMATCH',
      message: `Draft prNumber (${safeDraft.prNumber}) does not match independently collected context (${prContext.prNumber}).`,
    });
  }
  const contextSha = prContext.headSha ?? prContext.headRefOid;
  if (
    contextSha &&
    safeDraft.headSha &&
    String(contextSha) !== String(safeDraft.headSha)
  ) {
    inputErrors.push({
      code: 'E_CONTEXT_MISMATCH',
      message: `Draft headSha (${safeDraft.headSha}) does not match independently collected context (${contextSha}).`,
    });
  }
  if (!Array.isArray(safeDraft.findings)) {
    inputErrors.push({
      code: 'E_MISSING_FINDINGS_ARRAY',
      message: 'Review draft must include an explicit "findings" array.',
    });
  }

  const observed = extractObservedProfile(prContext);
  const characterizationCheck = verifyCharacterization(
    safeDraft.characterization,
    observed,
  );
  const diffText = String(prContext.diffText || '');
  const hasDiff = diffText.trim().length > 0;
  const fileHunks = hasDiff ? parseUnifiedDiffHunks(diffText) : {};

  const rawFindings = Array.isArray(safeDraft.findings)
    ? safeDraft.findings
    : [];
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

  // Score-driven publishing: publish all qualifying findings by default; optional caller cap if explicitly set
  const maxInlineComments =
    typeof options.maxInlineComments === 'number' &&
    options.maxInlineComments > 0
      ? options.maxInlineComments
      : null;
  if (maxInlineComments !== null) {
    let publishCount = 0;
    for (const item of scored) {
      if (item.decision === 'PUBLISH') {
        if (publishCount < maxInlineComments) {
          publishCount += 1;
        } else {
          item.decision = 'SUMMARY_ONLY';
          item.scoreBreakdown.penaltyReasons.push('capped_over_caller_limit');
        }
      }
    }
  }

  const published = scored.filter((f) => f.decision === 'PUBLISH');
  const summaryOnly = scored.filter((f) => f.decision === 'SUMMARY_ONLY');
  const dropped = scored.filter((f) => f.decision === 'DROP');

  const gateErrors = [
    ...inputErrors,
    ...(characterizationCheck.valid ? [] : characterizationCheck.errors),
  ];

  // Compute merge verdict from all verified non-speculative blockers
  const verifiedBlockers = [...published, ...summaryOnly].filter(
    (f) =>
      !f.scoreBreakdown.isSpeculative &&
      ((f.severity === 'P0' &&
        (f.decision === 'PUBLISH' ||
          f.signalScore >= THRESHOLDS.SUMMARY_MIN_SCORE)) ||
        (f.severity === 'P1' &&
          f.confidence === 'high' &&
          f.signalScore >= THRESHOLDS.SUMMARY_MIN_SCORE)),
  );
  const hasP0Blocker = verifiedBlockers.some((f) => f.severity === 'P0');
  const hasHighP1Blocker = verifiedBlockers.some(
    (f) =>
      f.severity === 'P1' &&
      f.signalScore >= THRESHOLDS.REQUEST_CHANGES_P1_MIN_SCORE,
  );

  let verdict = 'APPROVE';
  if (hasP0Blocker || hasHighP1Blocker) {
    verdict = 'REQUEST_CHANGES';
  } else if (
    published.length > 0 ||
    verifiedBlockers.length > 0 ||
    gateErrors.length > 0
  ) {
    verdict = 'COMMENT';
  }

  return {
    mode,
    status: gateErrors.length === 0 ? 'ok' : 'validation_errors',
    gateErrors,
    prNumber: resolvedPrNumber,
    headSha: resolvedHeadSha,
    observedProfile: observed,
    characterizationCheck,
    claimedCharacterization: safeDraft.characterization || null,
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

function formatInlineBody(f) {
  const locationNote =
    f.anchorFile !== f.file || f.anchorLine !== f.line
      ? `> 实际缺陷位置：\`${f.file}${f.line ? `:${f.line}` : ''}\`\n`
      : '';
  let suggestionBlock = '';
  if (f.autoFix) {
    suggestionBlock = `\n**建议修复:**\n\`\`\`suggestion\n${f.autoFix}\n\`\`\``;
  } else if (f.suggestedFix) {
    suggestionBlock = `\n**建议修复:** ${f.suggestedFix}`;
  }

  return [
    `**[${f.severity}] ${f.title}**（SignalScore: ${f.signalScore}/100）`,
    '',
    locationNote ? locationNote.trim() : null,
    f.problem,
    f.impact ? `**影响**: ${f.impact}` : null,
    suggestionBlock ? suggestionBlock.trim() : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildPublishPayload(result) {
  // In shadow mode, pass through all anchored findings while keeping unanchored ones separate (never trigger 422)
  const sourceItems =
    result.mode === 'shadow'
      ? result.allScored || result.published
      : result.published;

  const comments = [];
  const unanchoredComments = [];

  for (const f of sourceItems) {
    const canAttach =
      Boolean(f.duplicateOfThreadId) ||
      (Boolean(f.anchorFile) &&
        typeof f.anchorLine === 'number' &&
        f.anchorLine >= 1 &&
        (result.mode === 'shadow' || f.scoreBreakdown.hasValidInlineAnchor));

    const entry = {
      action: f.publishAction || 'NEW_THREAD',
      replyToThreadId: f.duplicateOfThreadId || null,
      path: f.anchorFile || f.file,
      line: f.anchorLine || f.line,
      side: 'RIGHT',
      severity: f.severity,
      confidence: f.confidence,
      signalScore: f.signalScore,
      gateDecision: f.decision,
      body: formatInlineBody(f),
    };

    if (canAttach) {
      comments.push(entry);
    } else {
      unanchoredComments.push(entry);
    }
  }

  return {
    mode: result.mode || 'soft',
    status: result.status || 'ok',
    prNumber: result.prNumber,
    headSha: result.headSha,
    verdict: result.verdict,
    appendixMarkdown: renderMarkdownReport(result),
    comments,
    unanchoredComments,
  };
}

/**
 * Render a scoring appendix Markdown block (designed to complement the Unified Report Format).
 */
function renderMarkdownReport(result) {
  const verdictLabel = {
    APPROVE: '✅ APPROVE（无高信噪比阻塞问题）',
    COMMENT: '⚠️ COMMENT（建议修改后复审）',
    REQUEST_CHANGES: '❌ REQUEST_CHANGES（存在高分 P0/P1 阻塞项）',
  }[result.verdict];

  const lines = [];
  lines.push(
    `### 量化门禁评分附录${result.prNumber ? `（PR #${result.prNumber}）` : ''}`,
  );
  lines.push('');
  lines.push(
    `- **门禁模式**: \`${result.mode}\` | **PR 定性（已核验）**: \`${result.characterizationCheck.effectiveType}\` ${result.characterizationCheck.valid ? '✅' : '⚠️ (已按客观信号自动纠偏)'}`,
  );
  lines.push(
    `- **门禁筛选结果**: 候选 ${result.counts.totalCandidates} 条 → **发布 ${result.counts.published} 条** / 仅报告 ${result.counts.summaryOnly} 条 / 自动过滤 ${result.counts.dropped} 条`,
  );
  lines.push(`- **门禁判定**: ${verdictLabel}`);
  lines.push('');

  if (Array.isArray(result.gateErrors) && result.gateErrors.length > 0) {
    lines.push('> [!WARNING]');
    lines.push(
      '> 门禁校验发现以下输入/定性问题（`soft`/`shadow` 模式下未阻断流程）：',
    );
    for (const err of result.gateErrors) {
      lines.push(`> - \`${err.code}\`: ${err.message}`);
    }
    lines.push('');
  }

  if (result.published.length === 0) {
    if (result.gateErrors.length === 0) {
      lines.push(
        '未发现达到行内发布阈值的高信噪比问题，本次发布 0 条行内评论。',
      );
      lines.push('');
    }
  } else {
    lines.push(
      '| 优先级 | 置信度 | SignalScore | 动作 | 类别 | 文件 | 标题 | 分数拆解 |',
    );
    lines.push('|---|---|---:|---|---|---|---|---|');
    for (const f of result.published) {
      const b = f.scoreBreakdown;
      const loc = f.anchorLine
        ? `\`${f.anchorFile}:${f.anchorLine}\``
        : `\`${f.anchorFile}\``;
      const breakdown = `${b.baseImpact}×${b.typeAlignment} +${b.evidenceScore} -${b.noisePenalty}`;
      lines.push(
        `| **${f.severity}** | \`${f.confidence}\` | **${f.signalScore}** | \`${f.publishAction}\` | \`${f.effectiveCategory}\` | ${loc} | ${escapeMdCell(f.title)} | \`${breakdown}\` |`,
      );
    }
    lines.push('');
  }

  const filteredCount = result.summaryOnly.length + result.dropped.length;
  if (filteredCount > 0) {
    lines.push('<details>');
    lines.push(
      `<summary>🔍 门禁未发内联评论明细（共 ${filteredCount} 条：仅报告 ${result.summaryOnly.length} 条 / 自动过滤 ${result.dropped.length} 条，点击展开核查）</summary>`,
    );
    lines.push('');
    if (result.summaryOnly.length > 0) {
      lines.push('#### 仅报告（SUMMARY_ONLY）');
      for (const f of result.summaryOnly) {
        const valve = f.scoreBreakdown.safetyValveApplied
          ? ' ⚠️ `safety_valve_p0_preserved`'
          : '';
        lines.push(
          `- [${f.severity}][${f.confidence}][Score ${f.signalScore}] \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${escapeMdCell(f.title)}${valve}`,
        );
      }
      lines.push('');
    }
    if (result.dropped.length > 0) {
      lines.push('#### 自动过滤（DROPPED）');
      for (const f of result.dropped) {
        const reasons = [
          ...f.scoreBreakdown.reclassifiedReasons,
          ...f.scoreBreakdown.penaltyReasons,
        ];
        lines.push(
          `- [Score ${f.signalScore}] \`${f.effectiveCategory}\` \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${escapeMdCell(f.title)}${reasons.length ? ` (${reasons.join(', ')})` : ''}`,
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
  if (cmd !== 'evaluate' || typeof args.input !== 'string' || !args.input) {
    process.stderr.write(
      'Usage: node development/scripts/review-score-gate.js evaluate --input <draft.json> [--mode shadow|soft|strict] [--context <pr-context.json>] [--diff <pr.diff>] [--repo <path>] [--out-json <validated.json>] [--out-md <appendix.md>] [--strict]\n',
    );
    process.exit(1);
  }

  let mode = 'soft';
  if (args.strict) {
    mode = 'strict';
  } else if (args.mode !== undefined) {
    if (typeof args.mode !== 'string' || !GATE_MODES.has(args.mode)) {
      process.stderr.write(
        `Invalid --mode "${args.mode}". Expected one of: shadow, soft, strict.\n`,
      );
      process.exit(1);
    }
    mode = args.mode;
  }

  const rawDraftText = fs.readFileSync(args.input, 'utf8');
  const parsed = parseReviewDraftSafely(rawDraftText);

  if (!parsed.ok) {
    if (mode === 'strict') {
      process.stderr.write(`Draft JSON parse failed: ${parsed.error}\n`);
      process.exit(2);
    }
    const fallbackResult = {
      mode,
      status: 'fallback_passthrough',
      gateErrors: [{ code: 'E_INVALID_DRAFT_JSON', message: parsed.error }],
      rawDraftPreview: rawDraftText.slice(0, 500),
    };
    if (typeof args['out-json'] === 'string') {
      fs.writeFileSync(
        args['out-json'],
        JSON.stringify(fallbackResult, null, 2),
      );
    }
    if (typeof args['out-md'] === 'string') {
      fs.writeFileSync(
        args['out-md'],
        `> ⚠️ Review score gate entered \`fallback_passthrough\` (${parsed.error}). Pipeline was not blocked.\n`,
      );
    }
    return;
  }

  const draft = parsed.draft;
  if (
    mode === 'strict' &&
    (typeof args.context !== 'string' || !args.context)
  ) {
    process.stderr.write(
      'Strict mode requires independently collected PR metadata via --context <pr-context.json>.\n',
    );
    process.exit(2);
  }

  let prContext = draft.prContext || {};
  if (typeof args.context === 'string' && args.context) {
    try {
      prContext = JSON.parse(fs.readFileSync(args.context, 'utf8'));
    } catch (ctxErr) {
      if (mode === 'strict') {
        process.stderr.write(`Context JSON parse failed: ${ctxErr.message}\n`);
        process.exit(2);
      }
      prContext = {};
    }
  }
  if (typeof args.diff === 'string' && args.diff) {
    prContext.diffText = fs.readFileSync(args.diff, 'utf8');
  }

  const result = evaluateReview(draft, prContext, {
    repoRoot: typeof args.repo === 'string' ? args.repo : process.cwd(),
    mode,
  });

  // In strict mode, fail before writing any output files
  if (mode === 'strict' && result.gateErrors.length > 0) {
    process.stderr.write(
      `Strict gate validation failed:\n${JSON.stringify(result.gateErrors, null, 2)}\n`,
    );
    process.exit(2);
  }

  const payload = buildPublishPayload(result);
  const reportMd = renderMarkdownReport(result);

  if (typeof args['out-json'] === 'string') {
    fs.writeFileSync(
      args['out-json'],
      JSON.stringify({ ...result, publishPayload: payload }, null, 2),
    );
  }
  if (typeof args['out-md'] === 'string') {
    fs.writeFileSync(args['out-md'], reportMd);
  }

  if (!args['out-md'] && !args['out-json']) {
    process.stdout.write(`${reportMd}\n`);
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
  parseConfidence,
  parseReviewDraftSafely,
  parseUnifiedDiffHunks,
  extractObservedProfile,
  verifyCharacterization,
  scoreFinding,
  evaluateReview,
  buildPublishPayload,
  renderMarkdownReport,
};
