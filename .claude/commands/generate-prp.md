# Create OneKey PRP

## Feature file: $ARGUMENTS

Generate a complete PRP for OneKey multi-chain wallet feature implementation with thorough research. Ensure context is passed to the AI agent to enable self-validation and iterative refinement. Read the feature file first to understand what needs to be created, how the examples provided help, and any other considerations.

The AI agent only gets the context you are appending to the PRP and training data. Assume the AI agent has access to the codebase and the same knowledge cutoff as you, so it's important that your research findings are included or referenced in the PRP. The Agent has Websearch capabilities, so pass URLs to documentation and examples.

## Research Process

1. **Codebase Analysis**
   - Search for similar features/patterns in the codebase
   - Identify files to reference in PRP
   - Note existing conventions to follow
   - Check test patterns for validation approach
   - Analyze OneKey-specific architecture patterns (multi-platform, multi-chain support)

2. **External Research**
   - Search for similar features/patterns online
   - Library documentation (include specific URLs)
   - Implementation examples (GitHub/StackOverflow/blogs)
   - Best practices and common pitfalls
   - Cryptocurrency/blockchain-related security considerations

3. **User Clarification** (if needed)
   - Specific patterns to mirror and where to find them?
   - Integration requirements and where to find them?
   - Platform-specific requirements (desktop/mobile/web/ext)

## PRP Generation

### Critical Context to Include and pass to the AI agent as part of the PRP
- **Documentation**: URLs with specific sections
- **Code Examples**: Real snippets from codebase
- **Gotchas**: Library quirks, version issues
- **Patterns**: Existing approaches to follow
- **OneKey Architecture**: Multi-platform file structure, import hierarchy rules
- **Security Considerations**: Private key handling, transaction verification, risk detection

### Implementation Blueprint
- Start with pseudocode showing approach
- Reference real files for patterns
- Include error handling strategy
- List tasks to be completed to fulfill the PRP in the order they should be completed
- Consider cross-platform compatibility (.native.ts, .web.ts, .desktop.ts, .ext.ts)

### Validation Gates (Must be Executable)

```bash
# TypeScript type checking
yarn tsc:only

# ESLint checking
yarn lint:only

# Test execution
yarn test
```

*** CRITICAL AFTER YOU ARE DONE RESEARCHING AND EXPLORING THE CODEBASE BEFORE YOU START WRITING THE PRP ***

*** ULTRATHINK ABOUT THE PRP AND PLAN YOUR APPROACH THEN START WRITING THE PRP ***

## Output
Save as: `.claude/PRPs/{feature-name}.md`

## Quality Checklist
- [ ] All necessary context included
- [ ] Validation gates are executable by AI
- [ ] References existing patterns
- [ ] Clear implementation path
- [ ] Error handling documented
- [ ] Cross-platform compatibility considered
- [ ] OneKey coding conventions followed
- [ ] Security considerations included
- [ ] Import hierarchy rules respected

Score the PRP on a scale of 1-10 (confidence level to succeed in one-pass implementation using Claude Code)

Remember: The goal is one-pass implementation success through comprehensive context.
