(function () {
  'use strict';

  if (globalThis.__onekeyTranslateInitialized) return;
  globalThis.__onekeyTranslateInitialized = true;

  const VERSION = '2.0.0';
  console.log(`[OneKey Translate] v${VERSION}`);

  // ============================================================
  // Configuration
  // ============================================================

  const BATCH_SIZE = 20;
  const BATCH_DELAY_MS = 200;
  const MAX_BATCH_CHARS = 4500;
  const MIN_TEXT_LENGTH = 2;
  const MAX_TEXT_LENGTH = 5000;
  const TRANSLATE_TIMEOUT_MS = 15_000;
  const MAX_CACHE_SIZE = 500;

  const SKIP_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'SVG',
    'MATH',
    'CANVAS',
    'VIDEO',
    'AUDIO',
    'MAP',
    'CODE',
    'PRE',
    'KBD',
    'VAR',
    'SAMP',
    'TEXTAREA',
    'INPUT',
    'SELECT',
  ]);

  const SKIP_PATTERNS = [
    /^[\s\d\p{P}\p{S}]+$/u,
    /^https?:\/\//,
    /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i,
    /^0x[0-9a-f]+$/i,
    /^[A-Za-z0-9+/=]{20,}$/,
    /^[0-9a-f]{8}-[0-9a-f]{4}/i,
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    /^bc1[a-z0-9]{25,90}$/,
    /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    /^[A-Z]{2,10}$/,
    /^v?\d+(\.\d+){1,3}$/,
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})/,
    /^({{[^}]+}}|\$\{[^}]+\})$/,
    /^@[\w.-]+$/,
    /^[$\u20AC\u00A3\u00A5]?\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?(?:\s?%|px|em|rem|ETH|BTC|GWEI|wei)?$/i,
  ];

  // ============================================================
  // Native Bridge
  // ============================================================

  const pendingResolvers = {};
  let nextRequestId = 0;

  function sendToNative(message) {
    const data = JSON.stringify(message);
    if (globalThis.ReactNativeWebView) {
      globalThis.ReactNativeWebView.postMessage(data);
    } else {
      console.log(`$$ONEKEY_TRANSLATE:${data}`);
    }
  }

  function translateAPI(texts, sl, tl) {
    return new Promise(function (resolve, reject) {
      nextRequestId += 1;
      const id = `tr_${nextRequestId}`;
      const timer = setTimeout(function () {
        delete pendingResolvers[id];
        reject(new Error('Translation timeout'));
      }, TRANSLATE_TIMEOUT_MS);

      pendingResolvers[id] = {
        resolve: function (result) {
          clearTimeout(timer);
          resolve(result);
        },
        timer: timer,
      };

      sendToNative({
        type: '$$ONEKEY_TRANSLATE_REQUEST',
        id: id,
        sessionId: sessionId,
        texts: texts,
        sourceLang: sl,
        targetLang: tl,
      });
    });
  }

  globalThis.addEventListener('message', function (event) {
    let data = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (!data || !data.type) return;

    if (data.type === '$$ONEKEY_TRANSLATE_COMMAND') {
      if (data.command === 'start') {
        startTranslation(data.targetLang, data.displayMode, data.sessionId);
      } else if (data.command === 'stop') {
        stopTranslation();
      } else if (data.command === 'restore') {
        restoreOriginal();
      }
      return;
    }

    if (data.type === '$$ONEKEY_TRANSLATE_RESPONSE') {
      // Ignore stale responses from previous translation sessions
      if (data.sessionId && data.sessionId !== sessionId) return;
      const entry = pendingResolvers[data.id];
      if (entry) {
        entry.resolve(data.translations);
        delete pendingResolvers[data.id];
      }
    }
  });

  // ============================================================
  // State - DOM translator pattern
  // ============================================================

  // WeakMap<Node, {id, updateId, originalText}>
  // Auto GC when nodes are removed from DOM
  const nodeStorage = new WeakMap();

  // WeakSet<Node> — nodes mutated by us, skip in MutationObserver
  const mutatedNodes = new WeakSet();

  // WeakMap<Element, Set<Node>> — groups text nodes by parent for IO
  const elementNodesMap = new WeakMap();

  let idCounter = 0;
  let translationCache = {};
  let cacheKeys = [];
  let pendingBatch = [];
  let batchTimer = null;
  let isTranslating = false;
  let targetLang = '';
  const sourceLang = 'auto';
  let displayMode = 'replace'; // 'replace' | 'bilingual'
  let sessionId = '';
  let mutationObs = null;
  let intersectionObs = null;

  // ============================================================
  // Text Utilities
  // ============================================================

  function shouldSkipText(text) {
    if (!text || text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH)
      return true;
    const trimmed = text.trim();
    if (!trimmed) return true;
    for (let i = 0; i < SKIP_PATTERNS.length; i += 1) {
      if (SKIP_PATTERNS[i].test(trimmed)) return true;
    }
    return false;
  }

  function cacheTranslation(original, translated) {
    if (Object.prototype.hasOwnProperty.call(translationCache, original))
      return;
    if (cacheKeys.length >= MAX_CACHE_SIZE) {
      delete translationCache[cacheKeys.shift()];
    }
    translationCache[original] = translated;
    cacheKeys.push(original);
  }

  // ============================================================
  // Node Registration - DOM translator node registry pattern
  //
  // Only Text nodes are registered. Each gets:
  //   id         — unique identifier (never reused)
  //   updateId   — incremented on content change, prevents stale translations
  //   originalText — saved before first modification for restore
  // ============================================================

  function registerNode(node) {
    if (nodeStorage.has(node)) return false;
    if (node.nodeType !== Node.TEXT_NODE) return false;
    const text = node.nodeValue;
    if (!text || !text.trim()) return false;

    const nodeId = idCounter;
    idCounter += 1;

    nodeStorage.set(node, {
      id: nodeId,
      updateId: 1,
      originalText: null,
    });
    return true;
  }

  function restoreNode(node) {
    const data = nodeStorage.get(node);
    if (!data) return;
    if (data.originalText !== null) {
      mutatedNodes.add(node);
      node.nodeValue = data.originalText;
    }
    nodeStorage.delete(node);
  }

  // Check if a node is inside a skip-tree (for MutationObserver paths)
  function isInSkipTree(node) {
    let el = node.parentElement;
    while (el) {
      const tag = el.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag)) return true;
      if (el.getAttribute && el.getAttribute('translate') === 'no') return true;
      if (el.classList && el.classList.contains('notranslate')) return true;
      if (el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  // ============================================================
  // DOM Traversal - DOM translator full-tree walk pattern
  //
  // Recursively walks DOM including Shadow DOM.
  // Only collects Text nodes; skips SKIP_TAGS subtrees entirely.
  // ============================================================

  function collectTextNodes(root) {
    const nodes = [];

    function walk(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toUpperCase();
        if (SKIP_TAGS.has(tag)) return;
        if (node.getAttribute && node.getAttribute('translate') === 'no')
          return;
        if (node.classList && node.classList.contains('notranslate')) return;
        if (node.isContentEditable) return;

        // Shadow DOM — recurse into shadow root children
        if (node.shadowRoot) {
          const shadowChildren = node.shadowRoot.children;
          for (let s = 0; s < shadowChildren.length; s += 1) {
            walk(shadowChildren[s]);
          }
        }
      }

      if (node.nodeType === Node.TEXT_NODE) {
        if (!nodeStorage.has(node)) {
          const text = node.nodeValue ? node.nodeValue.trim() : '';
          if (text && !shouldSkipText(text)) {
            nodes.push(node);
          }
        }
        return;
      }

      let child = node.firstChild;
      while (child) {
        walk(child);
        child = child.nextSibling;
      }
    }

    walk(root || document.body);
    return nodes;
  }

  // ============================================================
  // Batch Translation
  //
  // Groups texts, sends to native bridge, applies results.
  // Per-node updateId captured before API call and verified after,
  // preventing stale translations from being applied.
  // ============================================================

  function queueForTranslation(items) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (Object.prototype.hasOwnProperty.call(translationCache, item.text)) {
        applyToNode(item.node, translationCache[item.text]);
      } else {
        pendingBatch.push(item);
      }
    }
    scheduleBatchSend();
  }

  function scheduleBatchSend() {
    if (batchTimer || pendingBatch.length === 0) return;
    batchTimer = setTimeout(function () {
      batchTimer = null;
      sendBatch();
    }, BATCH_DELAY_MS);
  }

  function sendBatch() {
    if (pendingBatch.length === 0) return;

    const batch = [];
    let charCount = 0;
    while (pendingBatch.length > 0 && batch.length < BATCH_SIZE) {
      const next = pendingBatch[0];
      if (charCount + next.text.length > MAX_BATCH_CHARS && batch.length > 0)
        break;
      batch.push(pendingBatch.shift());
      charCount += next.text.length;
    }

    // Group by text, capture per-node state for race condition check
    const texts = [];
    const batchMap = {};

    for (let i = 0; i < batch.length; i += 1) {
      const item = batch[i];
      const data = nodeStorage.get(item.node);
      const entry = {
        node: item.node,
        capturedId: data ? data.id : -1,
        capturedUpdateId: data ? data.updateId : -1,
      };

      if (!Object.prototype.hasOwnProperty.call(batchMap, item.text)) {
        batchMap[item.text] = [];
        texts.push(item.text);
      }
      batchMap[item.text].push(entry);
    }

    translateAPI(texts, sourceLang, targetLang)
      .then(function (translations) {
        for (let j = 0; j < texts.length; j += 1) {
          const original = texts[j];
          const translated = (translations && translations[j]) || original;
          cacheTranslation(original, translated);

          const entries = batchMap[original];
          for (let k = 0; k < entries.length; k += 1) {
            const entry = entries[k];
            // Race condition guard — verify node state hasn't changed
            const currentData = nodeStorage.get(entry.node);
            const isCurrentEntry =
              currentData &&
              entry.capturedId === currentData.id &&
              entry.capturedUpdateId === currentData.updateId;

            if (isCurrentEntry) {
              applyToNode(entry.node, translated);
            }
          }
        }
      })
      .catch(function (err) {
        console.error('[OneKey Translate] error:', err);
      });

    if (pendingBatch.length > 0) scheduleBatchSend();
  }

  // ============================================================
  // Apply Translation - DOM translator core pattern
  //
  // ONLY modifies node.nodeValue on Text nodes.
  // Never touches innerHTML, textContent, or any Element.
  // This guarantees DOM structure (links, buttons, etc.) is preserved.
  // ============================================================

  function applyToNode(textNode, translatedText) {
    const data = nodeStorage.get(textNode);
    if (!data) return;

    // Save original text before first modification
    if (data.originalText === null) {
      data.originalText = textNode.nodeValue;
    }

    // No-op: translation returned original text unchanged — leave DOM alone
    if (translatedText === data.originalText) return;

    const newValue =
      displayMode === 'bilingual'
        ? `${data.originalText}\n${translatedText}`
        : translatedText;
    if (textNode.nodeValue === newValue) return;

    // Mark as self-caused mutation so MutationObserver skips it
    mutatedNodes.add(textNode);
    textNode.nodeValue = newValue;
  }

  // ============================================================
  // IntersectionObserver - DOM translator lazy translation
  //
  // Text nodes can't be observed directly by IO.
  // We map text nodes → parent Element, observe the Element,
  // and translate all its text nodes when it enters viewport.
  // ============================================================

  function setupIntersectionObserver() {
    if (!globalThis.IntersectionObserver) return;

    intersectionObs = new globalThis.IntersectionObserver(
      function (entries) {
        for (let i = 0; i < entries.length; i += 1) {
          const intersectionEntry = entries[i];
          if (intersectionEntry.isIntersecting) {
            const el = intersectionEntry.target;
            intersectionObs.unobserve(el);

            const textNodes = elementNodesMap.get(el);
            elementNodesMap.delete(el);
            if (textNodes) {
              const items = [];
              textNodes.forEach(function (textNode) {
                if (nodeStorage.has(textNode)) return;
                const text = textNode.nodeValue
                  ? textNode.nodeValue.trim()
                  : '';
                if (text && !shouldSkipText(text) && registerNode(textNode)) {
                  items.push({ node: textNode, text: text });
                }
              });
              if (items.length > 0) queueForTranslation(items);
            }
          }
        }
      },
      {
        rootMargin: '400px 0px',
        threshold: 0.1,
      },
    );
  }

  function canObserveElement(el) {
    if (!el) return false;
    if (el.nodeName === 'OPTION') return false;
    return document.body.contains(el);
  }

  function observeTextNodes(textNodes) {
    const immediateItems = [];

    for (let i = 0; i < textNodes.length; i += 1) {
      const textNode = textNodes[i];
      const parentEl = textNode.parentElement;

      // No IO support or non-observable parent -> translate immediately
      if (!intersectionObs || !parentEl || !canObserveElement(parentEl)) {
        if (registerNode(textNode)) {
          immediateItems.push({
            node: textNode,
            text: textNode.nodeValue.trim(),
          });
        }
      } else {
        // Group by parent element for IO observation
        let nodeSet = elementNodesMap.get(parentEl);
        if (!nodeSet) {
          nodeSet = new Set();
          elementNodesMap.set(parentEl, nodeSet);
          intersectionObs.observe(parentEl);
        }
        nodeSet.add(textNode);
      }
    }

    if (immediateItems.length > 0) queueForTranslation(immediateItems);
  }

  // ============================================================
  // MutationObserver - DOM translator persistent translation pattern
  //
  // Watches childList + characterData.
  // Uses WeakSet<mutatedNodes> to distinguish self-caused mutations
  // from external content changes (SPA updates, user input, etc.).
  // ============================================================

  function setupMutationObserver() {
    mutationObs = new MutationObserver(function (mutations) {
      if (!isTranslating) return;

      const newElements = [];

      for (let i = 0; i < mutations.length; i += 1) {
        const mutation = mutations[i];

        // --- characterData: text content of a Text node changed ---
        if (mutation.type === 'characterData') {
          const target = mutation.target;
          if (target.nodeType === Node.TEXT_NODE) {
            // Skip self-caused mutations
            if (mutatedNodes.has(target)) {
              mutatedNodes.delete(target);
            } else if (nodeStorage.has(target)) {
              // External change on a translated node -> re-translate
              const data = nodeStorage.get(target);
              data.updateId += 1;
              // Reset so bilingual mode picks up the new source text
              data.originalText = null;
              const text = target.nodeValue ? target.nodeValue.trim() : '';
              if (text && !shouldSkipText(text)) {
                queueForTranslation([{ node: target, text: text }]);
              }
            } else if (!isInSkipTree(target)) {
              // New text on an untracked node
              const newText = target.nodeValue ? target.nodeValue.trim() : '';
              if (newText && !shouldSkipText(newText) && registerNode(target)) {
                queueForTranslation([{ node: target, text: newText }]);
              }
            }
          }
        } else if (mutation.type === 'childList') {
          // --- childList: nodes added/removed ---
          for (let j = 0; j < mutation.addedNodes.length; j += 1) {
            const addedNode = mutation.addedNodes[j];
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              const tag = addedNode.tagName.toUpperCase();
              if (!SKIP_TAGS.has(tag)) {
                newElements.push(addedNode);
              }
            } else if (addedNode.nodeType === Node.TEXT_NODE) {
              if (mutatedNodes.has(addedNode)) {
                mutatedNodes.delete(addedNode);
              } else if (!isInSkipTree(addedNode)) {
                const addedText = addedNode.nodeValue
                  ? addedNode.nodeValue.trim()
                  : '';
                if (
                  addedText &&
                  !shouldSkipText(addedText) &&
                  registerNode(addedNode)
                ) {
                  queueForTranslation([{ node: addedNode, text: addedText }]);
                }
              }
            }
          }
        }
      }

      // Batch-process newly added elements
      if (newElements.length > 0) {
        const schedule =
          globalThis.requestIdleCallback ||
          function (cb) {
            setTimeout(cb, 200);
          };
        schedule(function () {
          for (let k = 0; k < newElements.length; k += 1) {
            if (newElements[k].isConnected) {
              const nodes = collectTextNodes(newElements[k]);
              if (nodes.length > 0) observeTextNodes(nodes);
            }
          }
        });
      }
    });

    mutationObs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // ============================================================
  // Public API
  // ============================================================

  function startTranslation(lang, mode, session) {
    if (isTranslating) return;
    targetLang = lang || 'zh';
    displayMode = mode || 'replace';
    sessionId = session || '';
    isTranslating = true;

    setupIntersectionObserver();
    setupMutationObserver();

    const textNodes = collectTextNodes(document.body);
    observeTextNodes(textNodes);
  }

  function stopTranslation() {
    isTranslating = false;
    if (mutationObs) {
      mutationObs.disconnect();
      mutationObs = null;
    }
    if (intersectionObs) {
      intersectionObs.disconnect();
      intersectionObs = null;
    }
    pendingBatch = [];
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    Object.keys(pendingResolvers).forEach(function (id) {
      clearTimeout(pendingResolvers[id].timer);
      delete pendingResolvers[id];
    });
  }

  function restoreOriginal() {
    stopTranslation();

    // Walk entire DOM (including Shadow DOM) and restore all translated nodes
    function walkAndRestore(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        restoreNode(node);
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.shadowRoot) {
        const shadowChildren = node.shadowRoot.children;
        for (let s = 0; s < shadowChildren.length; s += 1) {
          walkAndRestore(shadowChildren[s]);
        }
      }
      let child = node.firstChild;
      while (child) {
        walkAndRestore(child);
        child = child.nextSibling;
      }
    }

    walkAndRestore(document.body);
    translationCache = {};
    cacheKeys = [];
  }

  globalThis.__onekeyTranslate = {
    start: startTranslation,
    stop: stopTranslation,
    restore: restoreOriginal,
    isTranslating: function () {
      return isTranslating;
    },
  };
})();
