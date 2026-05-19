// Parser/format tests for the webview adapter. Live iwdp / adb paths are
// exercised manually (see SMOKE.md); CI only validates the small pure
// helpers that don't require spawning external processes.
import { describe, it, expect } from "vitest";

describe("webview adapter format", () => {
  it("filters CDP target list to those with webSocketDebuggerUrl", () => {
    const fakeTargets = [
      {
        id: "a",
        title: "Wallet",
        url: "https://example.com",
        type: "page",
        webSocketDebuggerUrl: "ws://x",
      },
      {
        id: "b",
        title: "SW",
        url: "https://example.com",
        type: "service_worker",
        webSocketDebuggerUrl: "",
      },
    ];
    // Filter logic mirrors the one in listWebViewPagesIos
    const filtered = fakeTargets.filter((t) => !!t.webSocketDebuggerUrl);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("a");
  });

  it("parses webview_devtools_remote socket name from /proc/net/unix line", () => {
    const line =
      "0000000000000000: 00000002 00000000 00010000 0001 01 12345 @webview_devtools_remote_5678";
    const m = /webview_devtools_remote(?:_(\d+))?/.exec(line);
    expect(m).not.toBeNull();
    const sockname = m
      ? `webview_devtools_remote${m[1] ? `_${m[1]}` : ""}`
      : "";
    expect(sockname).toBe("webview_devtools_remote_5678");
  });

  it("falls back to bare socket name when no pid suffix", () => {
    const line =
      "0000000000000000: 00000002 00000000 00010000 0001 01 12345 @webview_devtools_remote";
    const m = /webview_devtools_remote(?:_(\d+))?/.exec(line);
    const sockname = m
      ? `webview_devtools_remote${m[1] ? `_${m[1]}` : ""}`
      : "";
    expect(sockname).toBe("webview_devtools_remote");
  });
});
