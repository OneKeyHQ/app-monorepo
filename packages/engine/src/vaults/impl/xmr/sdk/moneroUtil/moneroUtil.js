/* eslint-disable */
var instantiate = (function () {
  var _scriptDir =
    typeof document !== 'undefined' && document.currentScript
      ? document.currentScript.src
      : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return function (instantiate) {
    instantiate = instantiate || {};

    var Module = typeof instantiate !== 'undefined' ? instantiate : {};
    var readyPromiseResolve, readyPromiseReject;
    Module['ready'] = new Promise(function (resolve, reject) {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
    var moduleOverrides = {};
    var key;
    for (key in Module) {
      if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key];
      }
    }
    var arguments_ = [];
    var thisProgram = './this.program';
    var quit_ = function (status, toThrow) {
      throw toThrow;
    };
    var ENVIRONMENT_IS_WEB = typeof window === 'object';
    var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
    var ENVIRONMENT_IS_NODE =
      typeof process === 'object' &&
      typeof process.versions === 'object' &&
      typeof process.versions.node === 'string';
    var scriptDirectory = '';
    function locateFile(path) {
      if (Module['locateFile']) {
        return Module['locateFile'](path, scriptDirectory);
      }
      return scriptDirectory + path;
    }
    var read_, readAsync, readBinary, setWindowTitle;
    function logExceptionOnExit(e) {
      if (e instanceof ExitStatus) return;
      var toLog = e;
      err('exiting due to exception: ' + toLog);
    }
    var nodeFS;
    var nodePath;
    if (ENVIRONMENT_IS_NODE) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = require('path').dirname(scriptDirectory) + '/';
      } else {
        scriptDirectory = __dirname + '/';
      }
      read_ = function shell_read(filename, binary) {
        if (!nodeFS) nodeFS = require('fs');
        if (!nodePath) nodePath = require('path');
        filename = nodePath['normalize'](filename);
        return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
      };
      readBinary = function readBinary(filename) {
        var ret = read_(filename, true);
        if (!ret.buffer) {
          ret = new Uint8Array(ret);
        }
        assert(ret.buffer);
        return ret;
      };
      readAsync = function readAsync(filename, onload, onerror) {
        if (!nodeFS) nodeFS = require('fs');
        if (!nodePath) nodePath = require('path');
        filename = nodePath['normalize'](filename);
        nodeFS['readFile'](filename, function (err, data) {
          if (err) onerror(err);
          else onload(data.buffer);
        });
      };
      if (process['argv'].length > 1) {
        thisProgram = process['argv'][1].replace(/\\/g, '/');
      }
      arguments_ = process['argv'].slice(2);
      process['on']('uncaughtException', function (ex) {
        if (!(ex instanceof ExitStatus)) {
          throw ex;
        }
      });
      process['on']('unhandledRejection', function (reason) {
        throw reason;
      });
      quit_ = function (status, toThrow) {
        if (keepRuntimeAlive()) {
          process['exitCode'] = status;
          throw toThrow;
        }
        logExceptionOnExit(toThrow);
        process['exit'](status);
      };
      Module['inspect'] = function () {
        return '[Emscripten Module object]';
      };
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href;
      } else if (typeof document !== 'undefined' && document.currentScript) {
        scriptDirectory = document.currentScript.src;
      }
      if (_scriptDir) {
        scriptDirectory = _scriptDir;
      }
      if (scriptDirectory.indexOf('blob:') !== 0) {
        scriptDirectory = scriptDirectory.substr(
          0,
          scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1,
        );
      } else {
        scriptDirectory = '';
      }
      {
        read_ = function (url) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, false);
          xhr.send(null);
          return xhr.responseText;
        };
        if (ENVIRONMENT_IS_WORKER) {
          readBinary = function (url) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            xhr.responseType = 'arraybuffer';
            xhr.send(null);
            return new Uint8Array(xhr.response);
          };
        }
        readAsync = function (url, onload, onerror) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.responseType = 'arraybuffer';
          xhr.onload = function () {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
              onload(xhr.response);
              return;
            }
            onerror();
          };
          xhr.onerror = onerror;
          xhr.send(null);
        };
      }
      setWindowTitle = function (title) {
        document.title = title;
      };
    } else {
    }
    var out = Module['print'] || console.log;
    var err = Module['printErr'] || console.warn;
    for (key in moduleOverrides) {
      if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key];
      }
    }
    moduleOverrides = null;
    if (Module['arguments']) arguments_ = Module['arguments'];
    if (Module['thisProgram']) thisProgram = Module['thisProgram'];
    if (Module['quit']) quit_ = Module['quit'];
    var wasmBinary;
    if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
    var noExitRuntime = Module['noExitRuntime'] || true;
    if (typeof WebAssembly !== 'object') {
      abort('no native wasm support detected');
    }
    var wasmMemory;
    var ABORT = false;
    var EXITSTATUS;
    function assert(condition, text) {
      if (!condition) {
        abort('Assertion failed: ' + text);
      }
    }
    var UTF8Decoder =
      typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
    function UTF8ArrayToString(heap, idx, maxBytesToRead) {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;
      while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;
      if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(heap.subarray(idx, endPtr));
      } else {
        var str = '';
        while (idx < endPtr) {
          var u0 = heap[idx++];
          if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue;
          }
          var u1 = heap[idx++] & 63;
          if ((u0 & 224) == 192) {
            str += String.fromCharCode(((u0 & 31) << 6) | u1);
            continue;
          }
          var u2 = heap[idx++] & 63;
          if ((u0 & 240) == 224) {
            u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
          } else {
            u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
          }
          if (u0 < 65536) {
            str += String.fromCharCode(u0);
          } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
          }
        }
      }
      return str;
    }
    function UTF8ToString(ptr, maxBytesToRead) {
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
    }
    function alignUp(x, multiple) {
      if (x % multiple > 0) {
        x += multiple - (x % multiple);
      }
      return x;
    }
    var buffer,
      HEAP8,
      HEAPU8,
      HEAP16,
      HEAPU16,
      HEAP32,
      HEAPU32,
      HEAPF32,
      HEAPF64;
    function updateGlobalBufferAndViews(buf) {
      buffer = buf;
      Module['HEAP8'] = HEAP8 = new Int8Array(buf);
      Module['HEAP16'] = HEAP16 = new Int16Array(buf);
      Module['HEAP32'] = HEAP32 = new Int32Array(buf);
      Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
      Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
      Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
      Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
      Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
    }
    var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216;
    var wasmTable;
    var __ATPRERUN__ = [];
    var __ATINIT__ = [];
    var __ATPOSTRUN__ = [];
    var runtimeInitialized = false;
    var runtimeKeepaliveCounter = 0;
    function keepRuntimeAlive() {
      return noExitRuntime || runtimeKeepaliveCounter > 0;
    }
    function preRun() {
      if (Module['preRun']) {
        if (typeof Module['preRun'] == 'function')
          Module['preRun'] = [Module['preRun']];
        while (Module['preRun'].length) {
          addOnPreRun(Module['preRun'].shift());
        }
      }
      callRuntimeCallbacks(__ATPRERUN__);
    }
    function initRuntime() {
      runtimeInitialized = true;
      callRuntimeCallbacks(__ATINIT__);
    }
    function postRun() {
      if (Module['postRun']) {
        if (typeof Module['postRun'] == 'function')
          Module['postRun'] = [Module['postRun']];
        while (Module['postRun'].length) {
          addOnPostRun(Module['postRun'].shift());
        }
      }
      callRuntimeCallbacks(__ATPOSTRUN__);
    }
    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb);
    }
    function addOnInit(cb) {
      __ATINIT__.unshift(cb);
    }
    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb);
    }
    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null;
    function addRunDependency(id) {
      runDependencies++;
      if (Module['monitorRunDependencies']) {
        Module['monitorRunDependencies'](runDependencies);
      }
    }
    function removeRunDependency(id) {
      runDependencies--;
      if (Module['monitorRunDependencies']) {
        Module['monitorRunDependencies'](runDependencies);
      }
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback();
        }
      }
    }
    Module['preloadedImages'] = {};
    Module['preloadedAudios'] = {};
    function abort(what) {
      {
        if (Module['onAbort']) {
          Module['onAbort'](what);
        }
      }
      what = 'Aborted(' + what + ')';
      err(what);
      ABORT = true;
      EXITSTATUS = 1;
      what += '. Build with -s ASSERTIONS=1 for more info.';
      var e = new WebAssembly.RuntimeError(what);
      readyPromiseReject(e);
      throw e;
    }
    var dataURIPrefix = 'data:application/octet-stream;base64,';
    function isDataURI(filename) {
      return filename.startsWith(dataURIPrefix);
    }
    function isFileURI(filename) {
      return filename.startsWith('file://');
    }
    // end include: URIUtils.js
    /** @param {boolean=} fixedasm */
    function createExportWrapper(name, fixedasm) {
      return function () {
        var displayName = name;
        var asm = fixedasm;
        if (!fixedasm) {
          asm = Module['asm'];
        }
        assert(
          runtimeInitialized,
          'native function `' +
            displayName +
            '` called before runtime initialization',
        );
        if (!asm[name]) {
          assert(
            asm[name],
            'exported native function `' + displayName + '` not found',
          );
        }
        return asm[name].apply(null, arguments);
      };
    }
    var wasmBinaryFile;
    wasmBinaryFile = 'moneroUtil.wasm';
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = locateFile(wasmBinaryFile);
    }
    function getBinary(file) {
      try {
        if (file == wasmBinaryFile && wasmBinary) {
          return new Uint8Array(wasmBinary);
        }
        if (readBinary) {
          return readBinary(file);
        } else {
          throw 'both async and sync fetching of the wasm failed';
        }
      } catch (err) {
        abort(err);
      }
    }
    function getBinaryPromise() {
      if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
        if (readAsync) {
          return new Promise(function (resolve, reject) {
            readAsync(
              wasmBinaryFile,
              function (response) {
                resolve(new Uint8Array(response));
              },
              reject,
            );
          });
        }
      }
      return Promise.resolve().then(function () {
        return getBinary(wasmBinaryFile);
      });
    }
    function createWasm() {
      var info = {
        'env': wasmImports,
        'wasi_snapshot_preview1': wasmImports,
      };
      function receiveInstance(instance, module) {
        var exports = instance.exports;
        Module['asm'] = exports;
        wasmMemory = Module['asm']['memory'];
        updateGlobalBufferAndViews(wasmMemory.buffer);
        wasmTable = Module['asm']['__indirect_function_table'];
        addOnInit(Module['asm']['__wasm_call_ctors']);
        removeRunDependency('wasm-instantiate');
      }
      addRunDependency('wasm-instantiate');
      function receiveInstantiationResult(result) {
        receiveInstance(result['instance']);
      }
      function instantiateArrayBuffer(receiver) {
        return getBinaryPromise()
          .then(function (binary) {
            return WebAssembly.instantiate(binary, info);
          })
          .then(function (instance) {
            return instance;
          })
          .then(receiver, function (reason) {
            err('failed to asynchronously prepare wasm: ' + reason);
            abort(reason);
          });
      }
      function instantiateAsync() {
        return instantiateArrayBuffer(receiveInstantiationResult);
      }
      if (Module['instantiateWasm']) {
        try {
          var exports = Module['instantiateWasm'](info, receiveInstance);
          return exports;
        } catch (e) {
          err('Module.instantiateWasm callback failed with error: ' + e);
          return false;
        }
      }
      instantiateAsync().catch(readyPromiseReject);
      return {};
    }
    function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
          callback(Module);
          continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            getWasmTableEntry(func)();
          } else {
            getWasmTableEntry(func)(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }
    function ___assert_fail(condition, filename, line, func) {
      abort(
        'Assertion failed: ' +
          UTF8ToString(condition) +
          ', at: ' +
          [
            filename ? UTF8ToString(filename) : 'unknown filename',
            line,
            func ? UTF8ToString(func) : 'unknown function',
          ],
      );
    }

    function _abort() {
      abort('native code called abort()');
    }
    function getWasmTableEntry(funcPtr) {
      return wasmTable.get(funcPtr);
    }
    var _emscripten_get_now;
    if (ENVIRONMENT_IS_NODE) {
      _emscripten_get_now = function () {
        var t = process['hrtime']();
        return t[0] * 1e3 + t[1] / 1e6;
      };
    } else
      _emscripten_get_now = function () {
        return performance.now();
      };
    var _emscripten_get_now_is_monotonic = true;
    function getCFunc(ident) {
      var func = Module['_' + ident]; // closure exported function
      assert(
        func,
        'Cannot call unknown function ' + ident + ', make sure it is exported',
      );
      return func;
    }

    function writeArrayToMemory(array, buffer) {
      assert(
        array.length >= 0,
        'writeArrayToMemory array must have a length (should be an array or typed array)',
      );
      HEAP8.set(array, buffer);
    }

    /**
     * @param {string|null=} returnType
     * @param {Array=} argTypes
     * @param {Arguments|Array=} args
     * @param {Object=} opts
     */
    function ccall(ident, returnType, argTypes, args, opts) {
      // For fast lookup of conversion functions
      var toC = {
        'string': (str) => {
          var ret = 0;
          if (str !== null && str !== undefined && str !== 0) {
            // null string
            // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
            var len = (str.length << 2) + 1;
            ret = stackAlloc(len);
            stringToUTF8(str, ret, len);
          }
          return ret;
        },
        'array': (arr) => {
          var ret = stackAlloc(arr.length);
          writeArrayToMemory(arr, ret);
          return ret;
        },
      };

      function convertReturnValue(ret) {
        if (returnType === 'string') {
          return UTF8ToString(ret);
        }
        if (returnType === 'boolean') return Boolean(ret);
        return ret;
      }

      var func = getCFunc(ident);
      var cArgs = [];
      var stack = 0;
      assert(returnType !== 'array', 'Return type should not be "array".');
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]];
          if (converter) {
            if (stack === 0) stack = stackSave();
            cArgs[i] = converter(args[i]);
          } else {
            cArgs[i] = args[i];
          }
        }
      }
      var ret = func.apply(null, cArgs);
      function onDone(ret) {
        if (stack !== 0) stackRestore(stack);
        return convertReturnValue(ret);
      }

      ret = onDone(ret);
      return ret;
    }

    /**
     * @param {string=} returnType
     * @param {Array=} argTypes
     * @param {Object=} opts
     */
    function cwrap(ident, returnType, argTypes, opts) {
      return function () {
        return ccall(ident, returnType, argTypes, arguments, opts);
      };
    }
    function setErrNo(value) {
      HEAP32[___errno_location() >> 2] = value;
      return value;
    }
    function _clock_gettime(clk_id, tp) {
      var now;
      if (clk_id === 0) {
        now = Date.now();
      } else if (
        (clk_id === 1 || clk_id === 4) &&
        _emscripten_get_now_is_monotonic
      ) {
        now = _emscripten_get_now();
      } else {
        setErrNo(28);
        return -1;
      }
      HEAP32[tp >> 2] = (now / 1e3) | 0;
      HEAP32[(tp + 4) >> 2] = ((now % 1e3) * 1e3 * 1e3) | 0;
      return 0;
    }
    function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }
    function emscripten_realloc_buffer(size) {
      try {
        wasmMemory.grow((size - buffer.byteLength + 65535) >>> 16);
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1;
      } catch (e) {}
    }
    function _emscripten_resize_heap(requestedSize) {
      var oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      var maxHeapSize = 2147483648;
      if (requestedSize > maxHeapSize) {
        return false;
      }
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
        overGrownHeapSize = Math.min(
          overGrownHeapSize,
          requestedSize + 100663296,
        );
        var newSize = Math.min(
          maxHeapSize,
          alignUp(Math.max(requestedSize, overGrownHeapSize), 65536),
        );
        var replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
          return true;
        }
      }
      return false;
    }
    var SYSCALLS = {
      mappings: {},
      buffers: [null, [], []],
      printChar: function (stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },
      varargs: undefined,
      get: function () {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
        return ret;
      },
      getStr: function (ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
      get64: function (low, high) {
        return low;
      },
    };
    function _fd_close(fd) {
      return 0;
    }
    function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {}
    function _fd_write(fd, iov, iovcnt, pnum) {
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[iov >> 2];
        var len = HEAP32[(iov + 4) >> 2];
        iov += 8;
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(fd, HEAPU8[ptr + j]);
        }
        num += len;
      }
      HEAP32[pnum >> 2] = num;
      return 0;
    }
    var wasmImports = {
      '__assert_fail': ___assert_fail,
      'abort': _abort,
      'emscripten_memcpy_big': _emscripten_memcpy_big,
      'emscripten_resize_heap': _emscripten_resize_heap,
      'fd_close': _fd_close,
      'fd_seek': _fd_seek,
      'fd_write': _fd_write,
    };
    var asm = createWasm();
    /** @type {function(...*):?} */
    var ___wasm_call_ctors = createExportWrapper('__wasm_call_ctors');
    /** @type {function(...*):?} */
    var _secret_key_to_public_key = (Module['_secret_key_to_public_key'] =
      createExportWrapper('secret_key_to_public_key'));
    /** @type {function(...*):?} */
    var _cn_fast_hash = (Module['_cn_fast_hash'] =
      createExportWrapper('cn_fast_hash'));
    /** @type {function(...*):?} */
    var _sc_reduce32 = (Module['_sc_reduce32'] =
      createExportWrapper('sc_reduce32'));
    /** @type {function(...*):?} */
    var _get_subaddress_secret_key = (Module['_get_subaddress_secret_key'] =
      createExportWrapper('get_subaddress_secret_key'));
    /** @type {function(...*):?} */
    var _scalarmultKey = (Module['_scalarmultKey'] =
      createExportWrapper('scalarmultKey'));
    /** @type {function(...*):?} */
    var _sc_add = (Module['_sc_add'] = createExportWrapper('sc_add'));
    /** @type {function(...*):?} */
    var ___errno_location = createExportWrapper('__errno_location');
    /** @type {function(...*):?} */
    var _fflush = (Module['_fflush'] = createExportWrapper('fflush'));
    /** @type {function(...*):?} */
    var _malloc = (Module['_malloc'] = createExportWrapper('malloc'));
    /** @type {function(...*):?} */
    var _free = (Module['_free'] = createExportWrapper('free'));
    /** @type {function(...*):?} */
    var _emscripten_stack_init = function () {
      return (_emscripten_stack_init =
        Module['asm']['emscripten_stack_init']).apply(null, arguments);
    };

    /** @type {function(...*):?} */
    var _emscripten_stack_get_free = function () {
      return (_emscripten_stack_get_free =
        Module['asm']['emscripten_stack_get_free']).apply(null, arguments);
    };

    /** @type {function(...*):?} */
    var _emscripten_stack_get_base = function () {
      return (_emscripten_stack_get_base =
        Module['asm']['emscripten_stack_get_base']).apply(null, arguments);
    };

    /** @type {function(...*):?} */
    var _emscripten_stack_get_end = function () {
      return (_emscripten_stack_get_end =
        Module['asm']['emscripten_stack_get_end']).apply(null, arguments);
    };

    /** @type {function(...*):?} */
    var stackSave = createExportWrapper('stackSave');
    /** @type {function(...*):?} */
    var stackRestore = createExportWrapper('stackRestore');
    /** @type {function(...*):?} */
    var stackAlloc = createExportWrapper('stackAlloc');
    /** @type {function(...*):?} */
    var _emscripten_stack_get_current = function () {
      return (_emscripten_stack_get_current =
        Module['asm']['emscripten_stack_get_current']).apply(null, arguments);
    };

    Module['ccall'] = ccall;
    Module['cwrap'] = cwrap;

    /** @type {function(...*):?} */
    var dynCall_jiji = (Module['dynCall_jiji'] =
      createExportWrapper('dynCall_jiji'));
    var calledRun;
    function ExitStatus(status) {
      this.name = 'ExitStatus';
      this.message = 'Program terminated with exit(' + status + ')';
      this.status = status;
    }
    dependenciesFulfilled = function runCaller() {
      if (!calledRun) run();
      if (!calledRun) dependenciesFulfilled = runCaller;
    };
    function run(args) {
      args = args || arguments_;
      if (runDependencies > 0) {
        return;
      }
      preRun();
      if (runDependencies > 0) {
        return;
      }
      function doRun() {
        if (calledRun) return;
        calledRun = true;
        Module['calledRun'] = true;
        if (ABORT) return;
        initRuntime();
        readyPromiseResolve(Module);
        if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();
        postRun();
      }
      if (Module['setStatus']) {
        Module['setStatus']('Running...');
        setTimeout(function () {
          setTimeout(function () {
            Module['setStatus']('');
          }, 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }
    }
    Module['run'] = run;
    if (Module['preInit']) {
      if (typeof Module['preInit'] == 'function')
        Module['preInit'] = [Module['preInit']];
      while (Module['preInit'].length > 0) {
        Module['preInit'].pop()();
      }
    }
    run();

    return instantiate.ready;
  };
})();
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = instantiate;
else if (typeof define === 'function' && define['amd'])
  define([], function () {
    return instantiate;
  });
else if (typeof exports === 'object') exports['instantiate'] = instantiate;

export default instantiate;
