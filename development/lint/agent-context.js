const fs = require('fs');
const path = require('path');

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

function relative(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath ? relativePath.split(path.sep).join('/') : '.';
}

function parseScalar(rawValue, { errors, filePath, key }) {
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  if (rawValue === 'null' || rawValue === '~') return null;

  if (rawValue.startsWith('"')) {
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      errors.push(`${filePath}: invalid quoted ${key}: ${error.message}`);
      return '';
    }
  }

  if (rawValue.startsWith("'")) {
    if (!rawValue.endsWith("'")) {
      errors.push(`${filePath}: unterminated quoted ${key}`);
      return '';
    }
    return rawValue.slice(1, -1).replaceAll("''", "'");
  }

  if (key === 'description' && /:\s/.test(rawValue)) {
    errors.push(
      `${filePath}: descriptions containing ": " must be quoted or folded YAML`,
    );
  }

  return rawValue;
}

function parseFrontmatter(source, filePath, errors) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    errors.push(`${filePath}: missing or malformed YAML frontmatter`);
    return { body: source, fields: {}, keys: new Set() };
  }

  const fields = {};
  const keys = new Set();
  const lines = match[1].split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const shouldParse =
      line.trim() && !line.trimStart().startsWith('#') && !/^\s/.test(line);
    if (shouldParse) {
      const fieldMatch = line.match(/^([a-zA-Z0-9_-]+):(?:\s*(.*))?$/);
      if (!fieldMatch) {
        errors.push(`${filePath}: invalid top-level frontmatter line: ${line}`);
      } else {
        const [, key, rawFieldValue = ''] = fieldMatch;
        if (keys.has(key)) {
          errors.push(`${filePath}: duplicate frontmatter key: ${key}`);
        } else {
          keys.add(key);

          if (!ALLOWED_FRONTMATTER_KEYS.has(key)) {
            errors.push(`${filePath}: unsupported frontmatter key: ${key}`);
          }

          const rawValue = rawFieldValue.trim();
          const blockStyleMatch = rawValue.match(
            /^([>|])(?:(?:[1-9][+-]?)|(?:[+-][1-9]?))?$/,
          );
          if (blockStyleMatch) {
            const blockStyle = blockStyleMatch[1];
            const block = [];
            while (
              index + 1 < lines.length &&
              (!lines[index + 1].trim() || /^\s/.test(lines[index + 1]))
            ) {
              index += 1;
              block.push(lines[index].trim());
            }
            fields[key] =
              blockStyle === '>'
                ? block.filter(Boolean).join(' ')
                : block.join('\n');
          } else {
            fields[key] = parseScalar(rawValue, {
              errors,
              filePath,
              key,
            });
          }
        }
      }
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
  const matches = [
    ...source.matchAll(/^\s*allow_implicit_invocation:\s*(\S+)\s*$/gm),
  ];
  if (matches.length === 0) return true;
  if (matches.length > 1) {
    errors.push(`${displayPath}: duplicate allow_implicit_invocation policy`);
    return true;
  }

  const value = matches[0][1];
  if (value !== 'true' && value !== 'false') {
    errors.push(
      `${displayPath}: allow_implicit_invocation must be true or false`,
    );
    return true;
  }
  return value === 'true';
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

function extractLinkTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  return trimmed.split(/\s+["']/)[0];
}

function validateMarkdownLinks(skillDirectory, rootDir, errors) {
  for (const filePath of collectMarkdownFiles(skillDirectory)) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const rawTarget = extractLinkTarget(match[1]);
      const target = rawTarget.split('#')[0];
      const ignored =
        !target ||
        /^(?:data:|https?:|mailto:|skill:|\/)/.test(target) ||
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
  const skillsDirectory = path.resolve(rootDir, config.skillsDirectory);
  const budgets = config.budgets;
  const stats = {
    discoverableSkills: 0,
    explicitSkills: 0,
    implicitDescriptionCharacters: 0,
    implicitSkills: 0,
    projectInstructionBytes: 0,
    totalDescriptionCharacters: 0,
  };

  if (config.schemaVersion !== 1) {
    errors.push(
      `Unsupported agent-context config schema: ${config.schemaVersion}`,
    );
  }
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
      const { body, fields } = parseFrontmatter(
        source,
        displaySkillFile,
        errors,
      );
      const name = fields.name;
      const description = fields.description;

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

      if (fields['disable-model-invocation'] === true && implicit) {
        errors.push(
          `${displaySkillFile}: disable-model-invocation requires agents/openai.yaml policy.allow_implicit_invocation: false`,
        );
      }

      const bodyLines = body ? body.split(/\r?\n/).length : 0;
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
  printStats(result.stats, config.budgets);

  if (result.errors.length > 0) {
    console.error(
      `[agent-context] failed with ${result.errors.length} violation(s):\n- ${result.errors.join('\n- ')}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log('[agent-context] passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  auditAgentContext,
};
