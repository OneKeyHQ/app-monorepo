const { getChromiumExecutableCandidates } = require('./chromium');

// cspell:ignore LOCALAPPDATA

describe('getChromiumExecutableCandidates', () => {
  test('includes installed-browser locations on Windows', () => {
    const candidates = getChromiumExecutableCandidates(
      {
        'PROGRAMFILES(X86)': 'D:\\Program Files (x86)',
        PROGRAMFILES: 'D:\\Program Files',
        LOCALAPPDATA: 'D:\\Users\\tester\\AppData\\Local',
      },
      'win32',
    );

    expect(candidates).toContain(
      'D:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    );
    expect(candidates).toContain(
      'D:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    );
    expect(candidates).toContain(
      'D:\\Users\\tester\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    );
  });

  test('does not add Windows locations on other platforms', () => {
    const candidates = getChromiumExecutableCandidates({}, 'linux');

    expect(candidates).not.toContain(
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    );
    expect(candidates).toContain('/usr/bin/google-chrome');
  });
});
