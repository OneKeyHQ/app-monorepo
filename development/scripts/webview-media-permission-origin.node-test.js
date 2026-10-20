const assert = require('node:assert/strict');
// cspell:ignore autoreleasepool
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing native function: ${signature}`);
  const openingBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed native function: ${signature}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    `${command} failed:\n${result.stdout}\n${result.stderr}`,
  );
}

test('Android media whitelist checks exact canonical requesting origins', (t) => {
  const source = fs.readFileSync(
    path.join(
      root,
      'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java',
    ),
    'utf8',
  );
  const viewSource = fs.readFileSync(
    path.join(
      root,
      'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    ),
    'utf8',
  );
  const methods = [
    'static String normalizeMediaPermissionOrigin(',
    'static Set<String> buildMediaPermissionWhitelistOrigins(',
    'private boolean isWhitelistedMediaOrigin(',
  ]
    .map((signature) => extractFunction(source, signature))
    .join('\n');
  const viewMethods = [
    'public void setMediaPermissionWhitelist(',
    'public boolean hasMediaPermissionWhitelist(',
    'public @Nullable Set<String> getMediaPermissionWhitelist(',
  ]
    .map((signature) =>
      extractFunction(viewSource, signature).replaceAll('@Nullable ', ''),
    )
    .join('\n');
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'webview-origin-java-'),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(directory, 'OriginProbe.java'),
    `
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
class RNCWebView {
  Set<String> mediaPermissionWhitelist;
  String url = "https://trusted.example";
  String getUrl() { return url; }
  ${viewMethods}
}
class RNCWebChromeClient {
  RNCWebView mWebView = new RNCWebView();
  ${methods}
  static void equal(String input, String expected) {
    String actual = normalizeMediaPermissionOrigin(input);
    if (!java.util.Objects.equals(actual, expected)) {
      throw new AssertionError(input + " expected " + expected + " got " + actual);
    }
  }
  public static void main(String[] args) {
    equal("HTTPS://EXAMPLE.COM:443/", "https://example.com:443");
    equal("https://example.com", "https://example.com:443");
    equal("http://Example.com", "http://example.com:80");
    equal("http://example.com:80/", "http://example.com:80");
    equal("https://example.com:8443", "https://example.com:8443");
    equal("https://example.com./", "https://example.com.:443");
    equal("https://127.0.0.1:443", "https://127.0.0.1:443");
    equal("https://[::1]:443/", "https://[::1]:443");
    for (String invalid : new String[] {
      "", "https://", "ftp://example.com", "https://user@example.com",
      "https://example.com?x", "https://example.com#x", "https://example.com/path",
      "https://example.com//", "https://example.com/%2F", "https://example.com:0",
      "https://example.com:65536", "https://example.com:", "https://example.com:abc"
    }) equal(invalid, null);
    RNCWebChromeClient probe = new RNCWebChromeClient();
    probe.mWebView.setMediaPermissionWhitelist(Set.of(
      "https://example.com", "https://example.com/path", "https://[::1]:8443",
      "https://alice.github.io", "https://alice.co.uk", "https://alice.example.co.uk",
      "https://a.example.com"));
    if (!probe.mWebView.hasMediaPermissionWhitelist()
        || probe.mWebView.getMediaPermissionWhitelist().size() != 6
        || !probe.isWhitelistedMediaOrigin("https://EXAMPLE.com:443/")
        || !probe.isWhitelistedMediaOrigin("https://[::1]:8443")
        || !probe.isWhitelistedMediaOrigin("https://alice.github.io")
        || !probe.isWhitelistedMediaOrigin("https://alice.co.uk")
        || !probe.isWhitelistedMediaOrigin("https://alice.example.co.uk")
        || !probe.isWhitelistedMediaOrigin("https://a.example.com")
        || probe.isWhitelistedMediaOrigin("https://sub.example.com")
        || probe.isWhitelistedMediaOrigin("https://bob.github.io")
        || probe.isWhitelistedMediaOrigin("https://bob.co.uk")
        || probe.isWhitelistedMediaOrigin("https://bob.example.co.uk")
        || probe.isWhitelistedMediaOrigin("https://b.example.com")
        || probe.isWhitelistedMediaOrigin("https://example.com.:443")
        || probe.isWhitelistedMediaOrigin("https://example.com:8443")
        || probe.isWhitelistedMediaOrigin("http://example.com")
        || probe.isWhitelistedMediaOrigin("https://[::1]:443")) {
      throw new AssertionError("Whitelist matched a different requesting origin");
    }
    probe.mWebView.setMediaPermissionWhitelist(Set.of("https://trusted.example"));
    if (probe.isWhitelistedMediaOrigin("https://evil.example")) {
      throw new AssertionError("Trusted top-level URL must not authorize an evil iframe");
    }
    probe.mWebView.setMediaPermissionWhitelist(Set.of("https://trusted.example", "https://evil.example"));
    if (!probe.isWhitelistedMediaOrigin("https://evil.example")) {
      throw new AssertionError("Explicitly whitelisted iframe must be allowed");
    }
    probe.mWebView.setMediaPermissionWhitelist(Set.of());
    if (!probe.mWebView.hasMediaPermissionWhitelist()
        || probe.isWhitelistedMediaOrigin("https://trusted.example")) {
      throw new AssertionError("Empty whitelist must deny all");
    }
    probe.mWebView.setMediaPermissionWhitelist(Set.of("https://example.com/path"));
    if (!probe.mWebView.hasMediaPermissionWhitelist()
        || !probe.mWebView.getMediaPermissionWhitelist().isEmpty()
        || probe.isWhitelistedMediaOrigin("https://example.com")) {
      throw new AssertionError("Invalid-only whitelist must deny all");
    }
    probe.mWebView.setMediaPermissionWhitelist(null);
    if (probe.mWebView.hasMediaPermissionWhitelist()
        || probe.mWebView.getMediaPermissionWhitelist() != null) {
      throw new AssertionError("Null whitelist must preserve the upstream permission path");
    }
  }
}
`,
  );
  run('javac', ['OriginProbe.java'], directory);
  run('java', ['RNCWebChromeClient'], directory);
});

test('Apple media whitelist checks exact canonical requesting origins', (t) => {
  if (process.platform !== 'darwin') {
    t.skip('Foundation is available on macOS');
    return;
  }
  const source = fs.readFileSync(
    path.join(root, 'node_modules/react-native-webview/apple/RNCWebViewImpl.m'),
    'utf8',
  );
  const functions = [
    'static NSString *OKCanonicalMediaPermissionOrigin(',
    'static NSString *OKCanonicalWhitelistedMediaOrigin(',
    'static NSSet<NSString *> *OKBuildMediaPermissionWhitelist(',
  ]
    .map((signature) => extractFunction(source, signature))
    .join('\n');
  const methods = [
    '- (void)setMediaPermissionWhitelist:(NSArray<NSString *> *)origins',
    '- (void)                         webView:(WKWebView *)webView\n  requestMediaCapturePermissionForOrigin:',
  ]
    .map((signature) => extractFunction(source, signature))
    .join('\n');
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'webview-origin-apple-'),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(directory, 'OriginProbe.m'),
    `
#import <Foundation/Foundation.h>
${functions}
typedef NS_ENUM(NSInteger, WKPermissionDecision) {
  WKPermissionDecisionPrompt, WKPermissionDecisionGrant, WKPermissionDecisionDeny
};
typedef NSInteger WKMediaCaptureType;
typedef NS_ENUM(NSInteger, RNCWebViewPermissionGrantType) {
  RNCWebViewPermissionGrantType_GrantIfSameHost_ElsePrompt,
  RNCWebViewPermissionGrantType_GrantIfSameHost_ElseDeny,
  RNCWebViewPermissionGrantType_Deny,
  RNCWebViewPermissionGrantType_Grant
};
@interface WKSecurityOrigin : NSObject
@property (nonatomic, copy) NSString *protocol;
@property (nonatomic, copy) NSString *host;
@property (nonatomic) NSInteger port;
@end
@implementation WKSecurityOrigin
@end
@interface WKFrameInfo : NSObject
@end
@implementation WKFrameInfo
@end
@interface WKWebView : NSObject
@property (nonatomic, strong) NSURL *URL;
@end
@implementation WKWebView
@end
@interface PermissionProbe : NSObject {
@public
  NSArray<NSString *> *_mediaPermissionWhitelist;
  NSSet<NSString *> *_mediaPermissionWhitelistSet;
  RNCWebViewPermissionGrantType _mediaCapturePermissionGrantType;
}
- (void)setMediaPermissionWhitelist:(NSArray<NSString *> *)origins;
- (void)webView:(WKWebView *)webView
  requestMediaCapturePermissionForOrigin:(WKSecurityOrigin *)origin
  initiatedByFrame:(WKFrameInfo *)frame
  type:(WKMediaCaptureType)type
  decisionHandler:(void (^)(WKPermissionDecision decision))decisionHandler;
@end
@implementation PermissionProbe
${methods}
@end
static void equal(NSString *input, NSString *expected) {
  NSString *actual = OKCanonicalWhitelistedMediaOrigin(input);
  if (!((actual == nil && expected == nil) || [actual isEqualToString:expected])) {
    NSLog(@"%@ expected %@ got %@", input, expected, actual);
    abort();
  }
}
static WKPermissionDecision decide(PermissionProbe *probe, WKWebView *webView,
                                   NSString *scheme, NSString *host, NSInteger port) {
  WKSecurityOrigin *origin = [WKSecurityOrigin new];
  origin.protocol = scheme;
  origin.host = host;
  origin.port = port;
  __block WKPermissionDecision result = WKPermissionDecisionPrompt;
  [probe webView:webView requestMediaCapturePermissionForOrigin:origin
        initiatedByFrame:nil type:0 decisionHandler:^(WKPermissionDecision decision) {
    result = decision;
  }];
  return result;
}
int main(void) { @autoreleasepool {
  equal(@"HTTPS://EXAMPLE.COM:443/", @"https://example.com:443");
  equal(@"https://example.com", @"https://example.com:443");
  equal(@"http://Example.com", @"http://example.com:80");
  equal(@"http://example.com:80/", @"http://example.com:80");
  equal(@"https://example.com:8443", @"https://example.com:8443");
  equal(@"https://example.com./", @"https://example.com.:443");
  equal(@"https://127.0.0.1:443", @"https://127.0.0.1:443");
  equal(@"https://[::1]:443/", @"https://[::1]:443");
  for (NSString *invalid in @[@"", @"https://", @"ftp://example.com", @"https://user@example.com",
      @"https://example.com?x", @"https://example.com#x", @"https://example.com/path",
      @"https://example.com//", @"https://example.com/%2F", @"https://example.com:0",
      @"https://example.com:65536", @"https://example.com:", @"https://example.com:abc"]) {
    equal(invalid, nil);
  }
  PermissionProbe *probe = [PermissionProbe new];
  WKWebView *webView = [WKWebView new];
  webView.URL = [NSURL URLWithString:@"https://trusted.example"];
  [probe setMediaPermissionWhitelist:@[@"https://example.com", @"https://example.com/path",
      @"https://[::1]:8443", @"https://alice.github.io", @"https://alice.co.uk",
      @"https://alice.example.co.uk",
      @"https://a.example.com"]];
  NSSet *whitelist = probe->_mediaPermissionWhitelistSet;
  if (whitelist.count != 6
      || ![whitelist containsObject:OKCanonicalMediaPermissionOrigin(@"https", @"EXAMPLE.com", 0)]
      || ![whitelist containsObject:OKCanonicalMediaPermissionOrigin(@"https", @"[::1]", 8443)]
      || [whitelist containsObject:OKCanonicalMediaPermissionOrigin(@"https", @"sub.example.com", 0)]
      || [whitelist containsObject:OKCanonicalMediaPermissionOrigin(@"https", @"example.com.", 0)]
      || [whitelist containsObject:OKCanonicalMediaPermissionOrigin(@"https", @"example.com", 8443)]
      || [whitelist containsObject:OKCanonicalMediaPermissionOrigin(@"http", @"example.com", 0)]
      || [whitelist containsObject:OKCanonicalMediaPermissionOrigin(@"https", @"[::1]", 443)]) {
    abort();
  }
  if (decide(probe, webView, @"https", @"EXAMPLE.com", 0) != WKPermissionDecisionGrant
      || decide(probe, webView, @"http", @"example.com", 0) != WKPermissionDecisionDeny
      || decide(probe, webView, @"https", @"alice.github.io", 0) != WKPermissionDecisionGrant
      || decide(probe, webView, @"https", @"bob.github.io", 0) != WKPermissionDecisionDeny
      || decide(probe, webView, @"https", @"alice.co.uk", 0) != WKPermissionDecisionGrant
      || decide(probe, webView, @"https", @"bob.co.uk", 0) != WKPermissionDecisionDeny
      || decide(probe, webView, @"https", @"alice.example.co.uk", 0) != WKPermissionDecisionGrant
      || decide(probe, webView, @"https", @"bob.example.co.uk", 0) != WKPermissionDecisionDeny
      || decide(probe, webView, @"https", @"a.example.com", 0) != WKPermissionDecisionGrant
      || decide(probe, webView, @"https", @"b.example.com", 0) != WKPermissionDecisionDeny
      || decide(probe, webView, @"https", @"example.com.", 0) != WKPermissionDecisionDeny
      || decide(probe, webView, @"https", @"[::1]", 8443) != WKPermissionDecisionGrant
      || decide(probe, webView, @"https", @"[::1]", 443) != WKPermissionDecisionDeny) {
    abort();
  }
  [probe setMediaPermissionWhitelist:@[@"https://trusted.example"]];
  if (decide(probe, webView, @"https", @"evil.example", 0) != WKPermissionDecisionDeny) {
    abort();
  }
  [probe setMediaPermissionWhitelist:@[@"https://trusted.example", @"https://evil.example"]];
  if (decide(probe, webView, @"https", @"evil.example", 0) != WKPermissionDecisionGrant) {
    abort();
  }
  [probe setMediaPermissionWhitelist:@[]];
  if (probe->_mediaPermissionWhitelistSet == nil
      || decide(probe, webView, @"https", @"trusted.example", 0) != WKPermissionDecisionDeny) {
    abort();
  }
  [probe setMediaPermissionWhitelist:@[@"https://trusted.example/path"]];
  if (probe->_mediaPermissionWhitelistSet.count != 0
      || decide(probe, webView, @"https", @"trusted.example", 0) != WKPermissionDecisionDeny) {
    abort();
  }
  probe->_mediaCapturePermissionGrantType = RNCWebViewPermissionGrantType_Grant;
  [probe setMediaPermissionWhitelist:nil];
  if (probe->_mediaPermissionWhitelistSet != nil
      || decide(probe, webView, @"https", @"evil.example", 0) != WKPermissionDecisionGrant) {
    abort();
  }
  return 0;
} }
`,
  );
  run(
    'clang',
    [
      '-fobjc-arc',
      '-framework',
      'Foundation',
      'OriginProbe.m',
      '-o',
      'OriginProbe',
    ],
    directory,
  );
  run(path.join(directory, 'OriginProbe'), [], directory);
});
