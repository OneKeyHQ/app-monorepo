// cspell:ignore lavamoat

const { enabledTargets } = require('./targets.cjs');

const policyFiles = enabledTargets.map(({ policy }) => `lavamoat/${policy}`);
const generatedPolicyPaths = [...policyFiles, 'lavamoat/review'];

function isGeneratedPolicyFile(file) {
  return (
    policyFiles.includes(file) ||
    file === 'lavamoat/review/README.review.md' ||
    (file.startsWith('lavamoat/review/') && file.endsWith('.json'))
  );
}

module.exports = { generatedPolicyPaths, isGeneratedPolicyFile };
