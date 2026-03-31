function transformTranslationEnumKey(pathSegments) {
  const normalizedPathSegments = pathSegments.map((segment) =>
    `${segment}`.trim(),
  );
  const key = normalizedPathSegments.join('_').replace(/[^A-Za-z0-9_$]/g, '_');

  return /^[A-Za-z_$]/.test(key) ? key : `_${key}`;
}

module.exports = transformTranslationEnumKey;
