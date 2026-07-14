const fs = require('fs');
const path = require('path');

const MarkdownIt = require('markdown-it');
const { parseDocument } = require('yaml');

const markdown = new MarkdownIt();

const ALLOWED_CONFIG_KEYS = new Set([
  'budgets',
  'projectInstructionFiles',
  'schemaVersion',
  'skillsDirectory',
]);

const ALLOWED_FRONTMATTER_KEYS = new Set([
  'allowed-tools',
  'argument-hint',
  'description',
  'disable-model-invocation',
  'license',
  'metadata',
  'name',
]);

const ALLOWED_SKILL_ENTRIES = new Set([
  'SKILL.md',
  'agents',
  'assets',
  'evals',
  'references',
  'scripts',
  'templates',
]);

const REQUIRED_BUDGET_KEYS = new Set([
  'maxDiscoverableSkills',
  'maxExplicitDescriptionCharactersPerSkill',
  'maxImplicitDescriptionCharacters',
  'maxImplicitDescriptionCharactersPerSkill',
  'maxImplicitSkills',
  'maxProjectInstructionBytes',
  'maxSkillBodyLines',
  'maxTotalDescriptionCharacters',
]);

function relative(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath ? relativePath.split(path.sep).join('/') : '.';
}

function isMapping(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateConfig(config, errors) {
  let valid = true;
  if (!isMapping(config)) {
    errors.push('Agent context config must be an object');
    return false;
  }

  for (const key of Object.keys(config)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      errors.push(`Agent context config: unsupported field: ${key}`);
      valid = false;
    }
  }

  if (config.schemaVersion !== 1) {
    errors.push(
      `Unsupported agent-context config schema: ${config.schemaVersion}`,
    );
    valid = false;
  }
  if (
    typeof config.skillsDirectory !== 'string' ||
    !config.skillsDirectory.trim()
  ) {
    errors.push(
      'Agent context config: skillsDirectory must be a non-empty string',
    );
    valid = false;
  }
  if (
    !Array.isArray(config.projectInstructionFiles) ||
    !config.projectInstructionFiles.every(
      (filePath) => typeof filePath === 'string' && filePath.trim(),
    )
  ) {
    errors.push(
      'Agent context config: projectInstructionFiles must contain only non-empty strings',
    );
    valid = false;
  }

  if (!isMapping(config.budgets)) {
    errors.push('Agent context config: budgets must be an object');
    return false;
  }

  for (const key of REQUIRED_BUDGET_KEYS) {
    if (!Object.hasOwn(config.budgets, key)) {
      errors.push(`Agent context config: missing required budget: ${key}`);
      valid = false;
    } else {
      const value = config.budgets[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        errors.push(
          `Agent context config: budget ${key} must be a finite non-negative number`,
        );
        valid = false;
      }
    }
  }
  for (const key of Object.keys(config.budgets)) {
    if (!REQUIRED_BUDGET_KEYS.has(key)) {
      errors.push(`Agent context config: unsupported budget: ${key}`);
      valid = false;
    }
  }

  return valid;
}

function parseYamlMapping(source, displayPath, errors) {
  const document = parseDocument(source, {
    prettyErrors: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    for (const error of document.errors) {
      errors.push(`${displayPath}: invalid YAML: ${error.message}`);
    }
    return null;
  }

  const value = document.toJS();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${displayPath}: YAML root must be a mapping`);
    return null;
  }
  return value;
}

function parseFrontmatter(source, filePath, errors) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    errors.push(`${filePath}: missing or malformed YAML frontmatter`);
    return { body: source, fields: {}, keys: new Set() };
  }

  const fields = parseYamlMapping(match[1], filePath, errors) ?? {};
  const keys = new Set(Object.keys(fields));

  for (const key of keys) {
    if (!ALLOWED_FRONTMATTER_KEYS.has(key)) {
      errors.push(`${filePath}: unsupported frontmatter key: ${key}`);
    }
  }

  return {
    body: source.slice(match[0].length),
    fields,
    keys,
  };
}

function readInvocationPolicy(policyPath, displayPath, errors) {
  if (!fs.existsSync(policyPath)) return true;

  const source = fs.readFileSync(policyPath, 'utf8');
  const config = parseYamlMapping(source, displayPath, errors);
  if (!config) return true;

  const policy = config.policy;
  if (policy === undefined) return true;
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    errors.push(`${displayPath}: policy must be a mapping`);
    return true;
  }

  const value = policy.allow_implicit_invocation;
  if (value === undefined) return true;
  if (typeof value !== 'boolean') {
    errors.push(
      `${displayPath}: allow_implicit_invocation must be true or false`,
    );
    return true;
  }
  return value;
}

function collectMarkdownFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }
  return files;
}

function collectMarkdownLinkTargets(tokens, targets = []) {
  for (const token of tokens) {
    if (token.type === 'link_open') {
      targets.push(token.attrGet('href'));
    } else if (token.type === 'image') {
      targets.push(token.attrGet('src'));
    }
    if (token.children) {
      collectMarkdownLinkTargets(token.children, targets);
    }
  }
  return targets;
}

function validateMarkdownLinks(skillDirectory, rootDir, errors) {
  for (const filePath of collectMarkdownFiles(skillDirectory)) {
    const source = fs.readFileSync(filePath, 'utf8');
    const linkTargets = collectMarkdownLinkTargets(markdown.parse(source, {}));
    for (const linkTarget of linkTargets) {
      const target = linkTarget.split('#')[0];
      const ignored =
        !target ||
        /^(?:data:|https?:|mailto:|skill:|\/)/i.test(target) ||
        target.includes('<') ||
        target.includes('*');

      if (!ignored) {
        let decodedTarget;
        try {
          decodedTarget = decodeURIComponent(target);
        } catch {
          errors.push(
            `${relative(rootDir, filePath)}: invalid link: ${target}`,
          );
        }

        if (
          decodedTarget &&
          !fs.existsSync(path.resolve(path.dirname(filePath), decodedTarget))
        ) {
          errors.push(
            `${relative(rootDir, filePath)}: missing relative link: ${target}`,
          );
        }
      }
    }
  }
}

function addBudgetError(errors, label, actual, maximum) {
  if (actual > maximum) {
    errors.push(`${label}: ${actual} exceeds budget ${maximum}`);
  }
}

function auditAgentContext({ config, rootDir }) {
  const errors = [];
  const stats = {
    discoverableSkills: 0,
    explicitSkills: 0,
    implicitDescriptionCharacters: 0,
    implicitSkills: 0,
    projectInstructionBytes: 0,
    totalDescriptionCharacters: 0,
  };

  if (!validateConfig(config, errors)) return { errors, stats };

  const skillsDirectory = path.resolve(rootDir, config.skillsDirectory);
  const budgets = config.budgets;
  if (!fs.existsSync(skillsDirectory)) {
    errors.push(`${config.skillsDirectory}: skills directory does not exist`);
    return { errors, stats };
  }

  const skillDirectories = fs
    .readdirSync(skillsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .toSorted((left, right) => left.name.localeCompare(right.name));

  for (const skillEntry of skillDirectories) {
    const skillDirectory = path.join(skillsDirectory, skillEntry.name);
    const entries = fs.readdirSync(skillDirectory);
    const caseInsensitiveSkillFile = entries.find(
      (entry) => entry.toLowerCase() === 'skill.md',
    );

    if (!caseInsensitiveSkillFile) {
      errors.push(
        `${relative(rootDir, skillDirectory)}: every skill directory must contain SKILL.md`,
      );
    } else {
      if (caseInsensitiveSkillFile !== 'SKILL.md') {
        errors.push(
          `${relative(rootDir, skillDirectory)}: rename ${caseInsensitiveSkillFile} to SKILL.md`,
        );
      }

      for (const entry of entries) {
        if (
          entry !== caseInsensitiveSkillFile &&
          !ALLOWED_SKILL_ENTRIES.has(entry)
        ) {
          errors.push(
            `${relative(rootDir, path.join(skillDirectory, entry))}: unsupported top-level skill entry`,
          );
        }
      }

      const skillFile = path.join(skillDirectory, caseInsensitiveSkillFile);
      const displaySkillFile = relative(rootDir, skillFile);
      const source = fs.readFileSync(skillFile, 'utf8');
      const { fields } = parseFrontmatter(source, displaySkillFile, errors);
      const name = fields.name;
      const description = fields.description;
      const disableModelInvocation = fields['disable-model-invocation'];

      stats.discoverableSkills += 1;

      if (typeof name !== 'string' || !/^[a-z0-9-]{1,64}$/.test(name)) {
        errors.push(
          `${displaySkillFile}: name must be 1-64 hyphen-case characters`,
        );
      } else if (name !== skillEntry.name) {
        errors.push(
          `${displaySkillFile}: name ${name} must match folder ${skillEntry.name}`,
        );
      }

      if (typeof description !== 'string' || !description.trim()) {
        errors.push(
          `${displaySkillFile}: description must be a non-empty string`,
        );
      }

      if (
        Object.hasOwn(fields, 'disable-model-invocation') &&
        typeof disableModelInvocation !== 'boolean'
      ) {
        errors.push(
          `${displaySkillFile}: disable-model-invocation must be true or false`,
        );
      }

      const policyPath = path.join(skillDirectory, 'agents', 'openai.yaml');
      const implicit = readInvocationPolicy(
        policyPath,
        relative(rootDir, policyPath),
        errors,
      );
      const descriptionLength =
        typeof description === 'string' ? description.length : 0;

      stats.totalDescriptionCharacters += descriptionLength;
      if (implicit) {
        stats.implicitSkills += 1;
        stats.implicitDescriptionCharacters += descriptionLength;
        addBudgetError(
          errors,
          `${displaySkillFile} implicit description characters`,
          descriptionLength,
          budgets.maxImplicitDescriptionCharactersPerSkill,
        );
      } else {
        stats.explicitSkills += 1;
        addBudgetError(
          errors,
          `${displaySkillFile} explicit description characters`,
          descriptionLength,
          budgets.maxExplicitDescriptionCharactersPerSkill,
        );
      }

      if (disableModelInvocation === true && implicit) {
        errors.push(
          `${displaySkillFile}: disable-model-invocation requires agents/openai.yaml policy.allow_implicit_invocation: false`,
        );
      }

      const bodyLines = source ? source.split(/\r?\n/).length : 0;
      addBudgetError(
        errors,
        `${displaySkillFile} body lines`,
        bodyLines,
        budgets.maxSkillBodyLines,
      );

      validateMarkdownLinks(skillDirectory, rootDir, errors);
    }
  }

  for (const documentPath of config.projectInstructionFiles) {
    const absolutePath = path.resolve(rootDir, documentPath);
    if (fs.existsSync(absolutePath)) {
      const bytes = fs.statSync(absolutePath).size;
      stats.projectInstructionBytes = Math.max(
        stats.projectInstructionBytes,
        bytes,
      );
      addBudgetError(
        errors,
        `${documentPath} bytes`,
        bytes,
        budgets.maxProjectInstructionBytes,
      );
    }
  }

  addBudgetError(
    errors,
    'Discoverable skills',
    stats.discoverableSkills,
    budgets.maxDiscoverableSkills,
  );
  addBudgetError(
    errors,
    'Implicit skills',
    stats.implicitSkills,
    budgets.maxImplicitSkills,
  );
  addBudgetError(
    errors,
    'Total description characters',
    stats.totalDescriptionCharacters,
    budgets.maxTotalDescriptionCharacters,
  );
  addBudgetError(
    errors,
    'Implicit description characters',
    stats.implicitDescriptionCharacters,
    budgets.maxImplicitDescriptionCharacters,
  );
  return { errors, stats };
}

function loadConfig() {
  const configPath = path.join(__dirname, 'agent-context.config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function printStats(stats, budgets) {
  console.log(
    `[agent-context] skills: ${stats.discoverableSkills}/${budgets.maxDiscoverableSkills} discoverable, ` +
      `${stats.implicitSkills}/${budgets.maxImplicitSkills} implicit, ${stats.explicitSkills} explicit`,
  );
  console.log(
    `[agent-context] descriptions: ${stats.implicitDescriptionCharacters}/${budgets.maxImplicitDescriptionCharacters} implicit chars, ` +
      `${stats.totalDescriptionCharacters}/${budgets.maxTotalDescriptionCharacters} total chars`,
  );
  console.log(
    `[agent-context] largest project instruction: ${stats.projectInstructionBytes}/${budgets.maxProjectInstructionBytes} bytes`,
  );
}

function main() {
  const rootDir = path.resolve(__dirname, '../..');
  const config = loadConfig();
  const result = auditAgentContext({ config, rootDir });

  if (result.errors.length > 0) {
    console.error(
      `[agent-context] failed with ${result.errors.length} violation(s):\n- ${result.errors.join('\n- ')}`,
    );
    process.exitCode = 1;
    return;
  }

  printStats(result.stats, config.budgets);
  console.log('[agent-context] passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  auditAgentContext,
};
