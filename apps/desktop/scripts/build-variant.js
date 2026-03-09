function getDesktopBuildVariant() {
  const buildVariant = String(
    process.env.ONEKEY_BUILD_VARIANT || '',
  ).toLowerCase();
  const allowSkipGpg =
    String(
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION || '',
    ).toLowerCase() === 'true';
  const isSkipGpgVariant = buildVariant === 'skip_gpg' || allowSkipGpg;

  const artifactPrefix = isSkipGpgVariant
    ? 'OneKey-Wallet-skip-gpg'
    : 'OneKey-Wallet';

  return {
    isSkipGpgVariant,
    productName: isSkipGpgVariant ? 'OneKey SG' : 'OneKey',
    artifactPrefix,
    liquidIconName: isSkipGpgVariant ? 'OneKeyLogoSkipGpg' : 'OneKeyLogo',
    iconPngPath: isSkipGpgVariant
      ? 'app/build/static/images/icons/512x512-skip-gpg.png'
      : 'app/build/static/images/icons/512x512.png',
    iconIcnsPath: isSkipGpgVariant
      ? 'app/build/static/images/icons/icon-skip-gpg.icns'
      : 'app/build/static/images/icons/icon.icns',
  };
}

module.exports = {
  getDesktopBuildVariant,
};
