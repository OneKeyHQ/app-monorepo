const { execSync } = require('child_process');
const { exit } = require('process');
const { parse } = require('@aivenio/tsc-output-parser');

function handleProblems(result) {
  let i18nErrorCount = 0;
  const i18nErrors = [];
  let basicErrorCount = 0;
  const basicErrors = [];

  for (const problem of parse(result)) {
    const message = problem.value.message.value;
    if (
      message.includes(`is not assignable to type 'ETranslations`) ||
      message.includes(`is not assignable to parameter of type 'ETranslations`)
    ) {
      i18nErrorCount += 1;
      i18nErrors.push(problem);
    } else {
      basicErrorCount += 1;
      basicErrors.push(problem);
    }
  }
  if (basicErrorCount > 0) {
    console.error(
      basicErrors
        .map(
          (p) =>
            `${p.value.path.value}: line ${p.value.cursor.value.line} col ${p.value.cursor.value.col}, ${p.value.message.value}`,
        )
        .join('\n'),
    );
    exit(1);
  } else {
    console.log(
      i18nErrors
        .map(
          (p) =>
            `${p.value.path.value}: line ${p.value.cursor.value.line} col ${p.value.cursor.value.col}, ${p.value.message.value}`,
        )
        .join('\n'),
    );
    console.log(`Found ${i18nErrorCount} i18n errors`);
  }
}

try {
  const result = execSync(
    `sh -c 'npx tsc --noEmit --tsBuildInfoFile \"$(yarn config get cacheFolder)\"/.app-mono-ts-cache'`,
  ).toString('utf-8');
  console.log(result);
} catch (error) {
  const errorMsg = error.stdout.toString('utf-8');
  handleProblems(errorMsg);
}

exit(0);
