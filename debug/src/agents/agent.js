'use strict';

// OneKey native debug bridge — Frida in-process agent.
//
// This file is loaded as a Frida script inside the target app process. The
// daemon (Node) talks to it through `rpc.exports` and the `send()` channel.
//
// Compatibility notes:
//  - Frida ships a QJS / V8 hybrid runtime; we deliberately avoid newer
//    syntax that may not be available everywhere. Stick to ES2017-safe
//    features: arrow functions, template literals, const/let, try/catch.
//  - No optional chaining (`?.`), no nullish coalescing (`??`),
//    no async/await — wrap async operations as plain Promises / callbacks
//    instead. `Java.perform` is synchronous from the script's view.

// hookId -> { listener, method }
const hooks = new Map();
let hookSeq = 0;

// Ring buffer for events emitted by hooks. The daemon also receives a live
// `send({kind:'event'})` per emit; the buffer exists so a late drainEvents
// caller can pick up events queued before they connected.
const pendingEvents = [];
const MAX_EVENTS = 1000;

function emit(evt) {
  pendingEvents.push(evt);
  if (pendingEvents.length > MAX_EVENTS) pendingEvents.shift();
  try {
    send({ kind: 'event', evt: evt });
  } catch (_) {
    // send() can throw if the script is being torn down; ignore.
  }
}

function platform() {
  if (typeof ObjC !== 'undefined' && ObjC.available) return 'ios';
  if (typeof Java !== 'undefined' && Java.available) return 'android';
  return 'unknown';
}

// Resolve an ObjC selector like "-[UIApplication sharedApplication]"
// or "+[NSString string]" to a callable Frida method handle.
function findObjcMethod(selector) {
  const m = /^([-+])\[([^\s]+)\s+([^\]]+)\]$/.exec(selector);
  if (!m) throw new Error('bad ObjC selector: ' + selector);
  const isInstance = m[1] === '-';
  const cls = ObjC.classes[m[2]];
  if (!cls) throw new Error('class not found: ' + m[2]);
  const methodKey = (isInstance ? '- ' : '+ ') + m[3];
  const fn = cls[methodKey];
  if (!fn) throw new Error('method not found: ' + selector);
  return { cls: cls, fn: fn, isInstance: isInstance, sigName: m[3] };
}

rpc.exports = {
  platform: function () {
    return platform();
  },

  // Call a method by selector. iOS: class methods only (no implicit receiver).
  // Android: "fully.qualified.ClassName.methodName".
  call: function (selector, args) {
    const argList = args || [];
    if (platform() === 'ios') {
      const info = findObjcMethod(selector);
      if (!info.isInstance) {
        const r = argList.length ? info.fn.apply(null, argList) : info.fn();
        return String(r);
      }
      throw new Error(
        'instance method calls require explicit receiver; not supported in MVP',
      );
    }
    if (platform() === 'android') {
      const dot = selector.lastIndexOf('.');
      if (dot < 0) throw new Error('bad Java selector: ' + selector);
      const className = selector.slice(0, dot);
      const methodName = selector.slice(dot + 1);
      let out;
      Java.perform(function () {
        const Klass = Java.use(className);
        const fn = Klass[methodName];
        if (!fn) throw new Error('method not found: ' + selector);
        const r = argList.length
          ? fn.apply(Klass, argList)
          : fn.call(Klass);
        out = String(r);
      });
      return out;
    }
    throw new Error('no Frida runtime available');
  },

  hook: function (methodSig, options) {
    options = options || {};
    const id = ++hookSeq;
    let listener;
    if (platform() === 'ios') {
      const info = findObjcMethod(methodSig);
      const impl = info.fn.implementation;
      listener = Interceptor.attach(impl, {
        onEnter: function () {
          emit({ id: id, kind: 'enter', method: methodSig, ts: Date.now() });
        },
        onLeave: function (retval) {
          emit({
            id: id,
            kind: 'leave',
            method: methodSig,
            ts: Date.now(),
            retval: String(retval),
          });
        },
      });
    } else if (platform() === 'android') {
      const dot = methodSig.lastIndexOf('.');
      const className = methodSig.slice(0, dot);
      const methodName = methodSig.slice(dot + 1);
      Java.perform(function () {
        const Klass = Java.use(className);
        const original = Klass[methodName];
        const overloads = original
          ? original.overloads || [original]
          : [];
        overloads.forEach(function (ov) {
          ov.implementation = function () {
            emit({
              id: id,
              kind: 'enter',
              method: methodSig,
              ts: Date.now(),
            });
            const r = ov.apply(this, arguments);
            emit({
              id: id,
              kind: 'leave',
              method: methodSig,
              ts: Date.now(),
              retval: String(r),
            });
            return r;
          };
        });
      });
      // Java implementation swap cannot be cleanly reverted from outside;
      // we keep the listener shape uniform but make detach a no-op.
      listener = {
        detach: function () {
          /* no-op for Android */
        },
      };
    } else {
      throw new Error('no Frida runtime');
    }
    hooks.set(id, { listener: listener, method: methodSig });
    return id;
  },

  unhook: function (id) {
    const h = hooks.get(id);
    if (!h) return false;
    try {
      h.listener.detach();
    } catch (_) {
      /* ignore */
    }
    hooks.delete(id);
    return true;
  },

  listHooks: function () {
    const out = [];
    hooks.forEach(function (v, k) {
      out.push({ id: k, method: v.method });
    });
    return out;
  },

  // Drain queued events for polling consumers.
  drainEvents: function (max) {
    const n = Math.min(max || 100, pendingEvents.length);
    return pendingEvents.splice(0, n);
  },

  // Enumerate live ObjC class instance counts (iOS only). For each loaded
  // class that isn't part of an Apple framework, count its live instances via
  // ObjC.chooseSync and return the top N by count.
  //
  // Caveats:
  //  - ObjC.chooseSync is expensive; we filter system-framework class names
  //    (NS*, UI*, CF*, CA*, _*, etc.) by regex up-front to keep the scan
  //    affordable on a real app with thousands of loaded classes.
  //  - rss_kb is a rough heuristic: count * 200B. Wiring a real
  //    class_getInstanceSize via NativeFunction is a follow-up.
  //  - Some classes (toll-free-bridged CF types, singletons) refuse
  //    enumeration; those are silently skipped.
  memoryClasses: function (top) {
    if (platform() !== 'ios') {
      throw new Error('memoryClasses currently iOS-only (Android: TODO)');
    }
    const limit = top || 20;
    const out = [];
    const names = Object.keys(ObjC.classes);
    // Skip Apple framework classes by name prefix to keep enumeration fast.
    // The user's own / OneKey-bundled classes are typically prefixed with
    // RCT*, ONE*, OneKey*, or app-specific names — those get enumerated.
    const SYSTEM_RE = /^(NS|UI|CF|CA|CL|MK|AV|MP|GLK|SK|SC|CK|CN|CB|CMK|CG|CT|CX|HK|MTL|WK|_|__)/;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (SYSTEM_RE.test(name)) continue;
      try {
        const found = ObjC.chooseSync({
          class: ObjC.classes[name],
          subclasses: false,
        });
        if (found && found.length > 0) {
          out.push({
            name: name,
            count: found.length,
            // 200 bytes/instance is a rough heuristic until we wire
            // class_getInstanceSize via NativeFunction.
            rss_kb: Math.round((found.length * 200) / 1024),
          });
        }
      } catch (e) {
        // Some classes can't be enumerated (CoreFoundation toll-free,
        // singleton-only, etc.) — skip silently.
      }
    }
    out.sort(function (a, b) {
      return b.count - a.count;
    });
    return out.slice(0, limit);
  },

  // Run user-supplied source inside this agent. The source is wrapped in a
  // function with an `exports` parameter so callers can opt-in to publishing
  // values back to the daemon.
  runScript: function (sourceText) {
    // eslint-disable-next-line no-new-func
    const fn = new Function('exports', sourceText);
    const exp = {};
    try {
      fn(exp);
      return { ok: true, exports: Object.keys(exp) };
    } catch (e) {
      return {
        ok: false,
        error: String(e && e.message ? e.message : e),
      };
    }
  },
};
