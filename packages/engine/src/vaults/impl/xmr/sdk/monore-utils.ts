class MoneroUtils {
  constructor(xmrModule){
    this.xmrModule = xmrModule
  }
  sc_reduce32: (data) => {
    var dataLen = data.length * data.BYTES_PER_ELEMENT;
    var dataPtr = Module._malloc(dataLen);
    var dataHeap = new Uint8Array(Module.HEAPU8.buffer, dataPtr, dataLen);
    dataHeap.set(data);
    Module.ccall('sc_reduce32', null, ['number'], [dataHeap.byteOffset]);
    var res = new Uint8Array(dataHeap);
    Module._free(dataHeap.byteOffset);
    return res;
  }
  secret_key_to_public_key = function(data) {
    var outLen = data.length * data.BYTES_PER_ELEMENT;
    var outPtr = Module._malloc(outLen);
    var outHeap = new Uint8Array(Module.HEAPU8.buffer, outPtr, outLen);
    var ok = Module.ccall('secret_key_to_public_key', 'boolean', ['array', 'number'], [data, outHeap.byteOffset]);
    var res = null;
    if (ok) res = new Uint8Array(outHeap);
    Module._free(outHeap.byteOffset);
    return res;
};
cn_fast_hash = function(data) {
  var outLen = 32;
  var outPtr = Module._malloc(outLen);
  var outHeap = new Uint8Array(Module.HEAPU8.buffer, outPtr, outLen);
  Module.ccall('cn_fast_hash', null, ['array', 'number', 'number'], [data, data.length * data.BYTES_PER_ELEMENT, outHeap.byteOffset]);
  var res = new Uint8Array(outHeap);
  Module._free(outHeap.byteOffset);
  return res;
};

hash_to_scalar = function(data) {
  return sc_reduce32(cn_fast_hash(data));
};

get_subaddress_secret_key = function(data, major, minor) {
  var outLen = 32;
  var outPtr = Module._malloc(outLen);
  var outHeap = new Uint8Array(Module.HEAPU8.buffer, outPtr, outLen);
  Module.ccall('get_subaddress_secret_key', null, ['array', 'number', 'number', 'number'], [data, major, minor, outHeap.byteOffset]);
  var res = new Uint8Array(outHeap);
  Module._free(outHeap.byteOffset);
  return res;
};

sc_add = function(data1, data2) {
  var outLen = 32;
  var outPtr = Module._malloc(outLen);
  var outHeap = new Uint8Array(Module.HEAPU8.buffer, outPtr, outLen);
  Module.ccall('sc_add', null, ['number', 'array', 'array'], [outHeap.byteOffset, data1, data2]);
  var res = new Uint8Array(outHeap);
  Module._free(outHeap.byteOffset);
  return res;
};

Module.lib.sc_add = sc_add;

scalarmultKey = function(P, a) {
  var outLen = 32;
  var outPtr = Module._malloc(outLen);
  var outHeap = new Uint8Array(Module.HEAPU8.buffer, outPtr, outLen);
  var ok = Module.ccall('scalarmultKey', 'boolean', ['number', 'array', 'array'], [outHeap.byteOffset, P, a]);
  var res = null;
  if (ok) res = new Uint8Array(outHeap);
  Module._free(outHeap.byteOffset);
  return res;
}

pub_keys_to_address = function(net, is_subaddress, public_spend_key, public_view_key) {
  var prefix;
  if (net == MONERO_MAINNET) {
      prefix = '12';
      if (is_subaddress) prefix = '2A';
  } else if (net == MONERO_TESTNET) {
      prefix = '35';
      if (is_subaddress) prefix = '3F';
  } else if (net == MONERO_STAGENET) {
      prefix = '18';
      if (is_subaddress) prefix = '24';
  } else {
      throw "Invalid net: " + net;
  }
  res_hex = prefix + toHexString(public_spend_key) + toHexString(public_view_key);
  checksum = cn_fast_hash(fromHexString(res_hex));
  res_hex += toHexString(checksum).substring(0,8);
  return base58_encode(fromHexString(res_hex));
};
};

