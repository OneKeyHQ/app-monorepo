export type IOsEndOfSupportPlatform =
  | 'ios'
  | 'android'
  | 'mac'
  | 'win'
  | 'linux';

export type IOsEndOfSupportRule = {
  // Devices running an OS older than this version see the notice.
  // Compared against the raw value each platform reports:
  //   ios / mac: OS version, e.g. '17.0'
  //   android:   API level, e.g. '29' (Android 10)
  //   win:       NT version, e.g. '10.0.22000' (Windows 11)
  //   linux:     kernel release, e.g. '5.15'
  minSupportedVersion: string;
  // Name shown to the user, e.g. 'iOS 17', 'Android 10', 'Windows 11'.
  minSupportedName: string;
  // Help-center article explaining why support ends and what to do on devices
  // that cannot upgrade. The "Learn more" link is hidden when omitted.
  learnMoreUrl?: string;
};

export type IOsEndOfSupportRules = Partial<
  Record<IOsEndOfSupportPlatform, IOsEndOfSupportRule>
>;

export type IOsEndOfSupportNotice = {
  // Stable per platform + threshold, used to remember dismissal. Raising the
  // threshold later yields a new id, so the notice shows again.
  id: string;
  minSupportedName: string;
  learnMoreUrl: string | undefined;
};
