const fs = require('fs');
const os = require('os');
const path = require('path');

const { auditAgentContext } = require('./agent-context');

function createConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    skillsDirectory: '.skillshare/skills',
    projectInstructionFiles: ['CLAUDE.md', 'AGENTS.md'],
    budgets: {
      maxDiscoverableSkills: 4,
      maxExplicitDescriptionCharactersPerSkill: 100,
      maxImplicitDescriptionCharacters: 100,
      maxImplicitDescriptionCharactersPerSkill: 50,
      maxImplicitSkills: 2,
      maxProjectInstructionBytes: 100,
      maxSkillBodyLines: 10,
      maxTotalDescriptionCharacters: 200,
      ...overrides,
    },
  };
}

function writeSkill(
  rootDir,
  name,
  {
    body = '# Skill\n\nUse this workflow.',
    description = 'Focused test skill.',
    explicit = false,
    fileName = 'SKILL.md',
    modelExplicit = false,
  } = {},
) {
  const skillDirectory = path.join(rootDir, '.skillshare/skills', name);
  fs.mkdirSync(skillDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(skillDirectory, fileName),
    [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      ...(modelExplicit ? ['disable-model-invocation: true'] : []),
      '---',
      '',
      body,
      '',
    ].join('\n'),
  );
  if (explicit) {
    const agentsDirectory = path.join(skillDirectory, 'agents');
    fs.mkdirSync(agentsDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDirectory, 'openai.yaml'),
      'policy:\n  allow_implicit_invocation: false\n',
    );
  }
  return skillDirectory;
}

describe('agent context lint', () => {
  let rootDir;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-context-lint-'));
    fs.mkdirSync(path.join(rootDir, '.skillshare/skills'), {
      recursive: true,
    });
    fs.writeFileSync(path.join(rootDir, 'CLAUDE.md'), '# Instructions\n');
  });

  afterEach(() => {
    fs.rmSync(rootDir, { force: true, recursive: true });
  });

  it('accepts implicit and cross-agent explicit skills within budget', () => {
    writeSkill(rootDir, 'implicit-skill');
    writeSkill(rootDir, 'explicit-skill', {
      explicit: true,
      modelExplicit: true,
    });

    const result = auditAgentContext({
      config: createConfig(),
      rootDir,
    });

    expect(result.errors).toEqual([]);
    expect(result.stats).toEqual(
      expect.objectContaining({
        discoverableSkills: 2,
        explicitSkills: 1,
        implicitSkills: 1,
      }),
    );
  });

  it('rejects startup catalog and project-instruction budget regressions', () => {
    writeSkill(rootDir, 'first-skill', { description: '12345' });
    writeSkill(rootDir, 'second-skill', { description: '67890' });
    fs.writeFileSync(path.join(rootDir, 'CLAUDE.md'), 'too large');

    const result = auditAgentContext({
      config: createConfig({
        maxImplicitDescriptionCharacters: 9,
        maxImplicitSkills: 1,
        maxProjectInstructionBytes: 4,
      }),
      rootDir,
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Implicit skills: 2 exceeds budget 1',
        'Implicit description characters: 10 exceeds budget 9',
        'CLAUDE.md bytes: 9 exceeds budget 4',
      ]),
    );
  });

  it.each([
    '>+',
    '>-',
    '|+',
    '|-',
    '>2',
    '>2+',
    '>2-',
    '>+2',
    '>-2',
    '|2',
    '|2+',
    '|2-',
    '|+2',
    '|-2',
  ])(
    'rejects oversized descriptions using the %s block scalar',
    (blockStyle) => {
      writeSkill(rootDir, 'oversized-description', {
        description: `${blockStyle}\n  ${'x'.repeat(120)}`,
      });

      const result = auditAgentContext({
        config: createConfig({
          maxImplicitDescriptionCharacters: 10,
          maxImplicitDescriptionCharactersPerSkill: 10,
          maxTotalDescriptionCharacters: 10,
        }),
        rootDir,
      });

      expect(result.errors).toEqual(
        expect.arrayContaining([
          '.skillshare/skills/oversized-description/SKILL.md implicit description characters: 120 exceeds budget 10',
          'Implicit description characters: 120 exceeds budget 10',
          'Total description characters: 120 exceeds budget 10',
        ]),
      );
    },
  );

  it('budgets equivalent project instruction files independently', () => {
    writeSkill(rootDir, 'focused-skill');
    fs.writeFileSync(path.join(rootDir, 'CLAUDE.md'), '1234567890');
    fs.writeFileSync(path.join(rootDir, 'AGENTS.md'), '1234567890');

    const result = auditAgentContext({
      config: createConfig({ maxProjectInstructionBytes: 10 }),
      rootDir,
    });

    expect(result.errors).toEqual([]);
    expect(result.stats.projectInstructionBytes).toBe(10);
  });

  it('requires Codex explicit policy for Claude explicit skills', () => {
    writeSkill(rootDir, 'operation-skill', { modelExplicit: true });

    const result = auditAgentContext({
      config: createConfig(),
      rootDir,
    });

    expect(result.errors).toContain(
      '.skillshare/skills/operation-skill/SKILL.md: disable-model-invocation requires agents/openai.yaml policy.allow_implicit_invocation: false',
    );
  });

  it('rejects incorrect filenames, oversized bodies, and broken links', () => {
    writeSkill(rootDir, 'broken-skill', {
      body: `${Array.from({ length: 11 }, () => 'line').join('\n')}\n[Missing](references/missing.md)`,
      fileName: 'skill.md',
    });

    const result = auditAgentContext({
      config: createConfig(),
      rootDir,
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        '.skillshare/skills/broken-skill: rename skill.md to SKILL.md',
        '.skillshare/skills/broken-skill/skill.md body lines: 14 exceeds budget 10',
        '.skillshare/skills/broken-skill/skill.md: missing relative link: references/missing.md',
      ]),
    );
  });
});
