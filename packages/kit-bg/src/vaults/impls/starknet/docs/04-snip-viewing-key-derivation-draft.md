# SNIP draft: STRK20 Viewing Key Derivation (copy, 2026-09-18)

Source: draft by Adrien Lacombe (@adrienlacombe), SNIP number TBD, status Draft,
created 2026-07-16, last history entry 2026-07-28. Copied verbatim for
implementation reference; the upstream text prevails if they diverge.

---

## Simple Summary

Derive the private STRK20 viewing key from the account's existing leaf private
key using a purpose-bound HMAC-SHA256 construction performed inside the wallet
or hardware device.

## Abstract

STRK20 wallets need a stable private viewing key to discover and decrypt a
user's private state. Wallets that derive this key differently cannot recover
the same private history after restoring the same Starknet account.

This SNIP defines one derivation profile, `account-leaf-v1`. The profile uses
the private scalar of the account's normal single-key signer as the secret key
to a context-bound HMAC-SHA256 derivation. The account private key never leaves
the software wallet, hardware wallet, or secure element that already holds it.

The construction supports both Stark-curve and secp256k1 account leaf keys. It
does not introduce a separate HD path and does not derive secret material from
a signature. The resulting viewing key is a canonical Stark-curve scalar
scoped to a chain, account, and STRK20 pool.

## Scope

This SNIP covers the single private scalar currently called the STRK20
`viewing_key`. That scalar grants access to private STRK20 state and is also
used by the protocol in computations beyond passive incoming-note detection.
It MUST therefore be handled as highly sensitive secret material.

This profile applies to accounts controlled by one canonical Stark-curve or
secp256k1 leaf private key. Selecting a key for multisignature, threshold,
passkey, social-recovery, or other account schemes with no single canonical
leaf is outside scope.

This SNIP does not define a dapp-facing wallet RPC method and does not change
STRK20 contracts.

## Specification

### Definitions

- **Account**: the Starknet account contract address whose STRK20 state is
  being accessed.
- **Account leaf private key**: the private scalar used by the account's
  canonical single-key signer, after all normal wallet derivation and any
  curve-specific grinding.
- **Account key scheme**: either Stark-curve or secp256k1 for this revision.
- **Pool**: the STRK20 privacy-pool contract for which the key is used.
- **Registered public key**: the public x-coordinate stored by the pool for an
  account.
- **Wallet boundary**: the software wallet, hardware wallet, secure element,
  or combination of those components trusted to handle the viewing key.

### Assumed pool interface

For each account address, the pool stores at most one registered public
viewing key: the x-coordinate of `k * G` for that account's private viewing key
`k`. The registered key is readable on-chain, is immutable for the current
pool generation, and is the value that recovery matches against.

### Stark-curve scalar range

Let `n` be the Stark-curve order and `H` its lower-half boundary:

```text
n = 0x0800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2f
H = floor(n / 2)
```

An STRK20 private viewing key `k` is canonical when:

```text
1 <= k < H
```

The strict upper bound is intentional. Implementations MUST NOT interpret the
range as inclusive.

The corresponding public viewing key is the x-coordinate of `k * G`, where
`G` is the Stark-curve generator. The account key scheme does not change the
curve used for the STRK20 viewing key.

### Account leaf private key

The input secret `d` MUST be the exact private scalar used by the account's
normal single-key signer:

```text
1 <= d < q
```

Here `q` is the order of the account signer's curve. For a Stark-curve account,
`q = n`. For a secp256k1 account:

```text
q = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141
```

The wallet MUST serialize `d` as exactly 32 bytes in unsigned big-endian order:

```text
account_leaf_private_key_be32 = I2OSP(d, 32)
```

`I2OSP(value, length)` is the unsigned big-endian integer encoding from
RFC 8017 and MUST fail if `value` does not fit in `length` bytes.

The profile starts after the wallet's normal account-key derivation. A
hierarchical wallet or device MUST select the same path and curve-specific
processing used to obtain the account signer. It MUST NOT derive a new child
path for STRK20. It MUST NOT use a session, delegated, or ephemeral key in
place of the account's canonical leaf.

The account key scheme is used to locate and validate the leaf key but is not
included in the KDF input.

### Derivation context

Every derivation MUST use the following context:

```text
DerivationContext {
    version:         1,
    chain_id:        felt252,
    account_address: felt252,
    pool_address:    felt252,
    key_index:       u128
}
```

`key_index` MUST be `0` for the current STRK20 pool generation. It is reserved
for a future pool generation that supports explicit key rotation. Wallets MUST
NOT increment it locally for a pool whose registered public key is immutable.

The context is serialized as fixed-width bytes:

```text
context_bytes =
    I2OSP(version, 4) ||
    I2OSP(chain_id, 32) ||
    I2OSP(account_address, 32) ||
    I2OSP(pool_address, 32) ||
    I2OSP(key_index, 16)
```

The serialized context is exactly 116 bytes. Implementations MUST NOT use
variable-width integer encodings or omit leading zero bytes.

### `account-leaf-v1` derivation

The profile identifier is the ASCII string `account-leaf-v1`. The HMAC domain
separator is the exact, case-sensitive ASCII string
`STRK20_ACCOUNT_LEAF_V1`.

The profile uses HMAC-SHA256 as specified by RFC 2104 and RFC 6234:

```text
limit = 2^256 - (2^256 mod n)

function derive_viewing_key(account_leaf_private_key_be32, context_bytes):
    require length(account_leaf_private_key_be32) == 32
    require length(context_bytes) == 116

    for counter from 0 to 2^32 - 1:
        data =
            ASCII("STRK20_ACCOUNT_LEAF_V1") ||
            context_bytes ||
            I2OSP(counter, 4)

        digest = HMAC-SHA256(
            key = account_leaf_private_key_be32,
            data = data,
        )
        candidate = OS2IP(digest)

        if candidate >= limit:
            continue

        x = candidate mod n
        if x == 0:
            continue

        k = min(x, n - x)
        if 1 <= k < H:
            return k

    fail
```

`OS2IP` is the unsigned big-endian decoding from RFC 8017. Rejecting values at
or above `limit` before reducing modulo `n` removes modulo bias. A conforming
implementation MUST perform that rejection rather than applying an
unconditional reduction.

Folding `x` and `n - x` to the same lower-half scalar gives a unique scalar
for each public x-coordinate. The retry also handles the negligible cases
where the reduced candidate is zero or folds to exactly `H`.

Any change to the account-leaf definition, domain separator, serialization,
HMAC construction, context, or scalar mapping requires a new profile
identifier and domain separator.

### Persistence

For every account and pool, the wallet SHOULD persist at least:

```text
{
    profile_id: "account-leaf-v1",
    version: 1,
    chain_id,
    account_address,
    pool_address,
    key_index,
    account_key_scheme,
    account_key_fingerprint,
    account_derivation_path,
    registered_public_key
}
```

`account_key_fingerprint` is implementation-defined and MUST be derived only
from public information, such as a hash of the account signer's public key. It
MUST NOT be derived from the private key or viewing key.

This metadata MUST be kept in wallet-private storage. Publishing it on-chain
is NOT RECOMMENDED.

Once a pool has a registered public viewing key, that key is authoritative. A
wallet MUST NOT register a different key merely because its account signer or
local metadata changed.

### Recovery

To recover an existing STRK20 account, a wallet:

1. reads the registered public viewing key for `account_address` from the
   selected pool;
2. recovers or selects the account's original leaf private key;
3. derives `account-leaf-v1` with the exact chain, account, pool, and key
   index;
4. computes the public x-coordinate of the candidate viewing key; and
5. accepts the candidate only if it exactly equals the registered public key.

Failure to find a match MUST NOT cause the wallet to register a replacement,
discard local private history, or report a zero balance as authoritative.

### Account-key rotation

The viewing key is bound to the account leaf private key. Replacing that leaf
produces a different viewing key even when the account contract address is
unchanged. Before account-key rotation, signer replacement, or account
migration, a wallet MUST retain the existing viewing key in secure storage.

### Wallet and dapp boundary

A wallet implementation:

- MUST keep the account leaf private key inside its existing secret boundary;
- MUST keep the viewing key inside the wallet boundary;
- MUST NOT expose either secret through a public dapp RPC;
- MUST NOT allow a dapp to choose the account-key selector, domain separator,
  derivation context, or KDF counter; and
- MAY expose a non-secret capability indicating support for
  `account-leaf-v1`.

## Test Cases

Common context:

```text
version         = 1
chain_id        = 0x534e5f5345504f4c4941  ("SN_SEPOLIA")
account_address = 0x1234
pool_address    = 0x5678
key_index       = 0

version_be4 =
  0x00000001
chain_id_be32 =
  0x00000000000000000000000000000000000000000000534e5f5345504f4c4941
account_address_be32 =
  0x0000000000000000000000000000000000000000000000000000000000001234
pool_address_be32 =
  0x0000000000000000000000000000000000000000000000000000000000005678
key_index_be16 =
  0x00000000000000000000000000000000

domain_separator_ascii = "STRK20_ACCOUNT_LEAF_V1"
domain_separator_hex =
  0x5354524b32305f4143434f554e545f4c4541465f5631
```

### Primary vector

```text
account_leaf_private_key =
  0x0000000000000000000000000000000000000000000000000000000000000001
kdf_counter = 0
hmac_sha256_output =
  0x3ed14752a332877b8097f5bc9b24c89689a29a5d10266060345df8685c8efdad
reduced_scalar =
  0x06d14752a33287048097f5bc9b24c898851b195c83d081015f8f889c9c22e164
viewing_key =
  0x012eb8ad5ccd790c7f680a4364db37673265f91147173130bed719a511a36bcb
public_key_x =
  0x0435ada564d3bb1c5ac7caac8aa5fdc7dfa5de1aea83ff660099ea619a08c7a5
```

### Rejection-sampling vector

```text
account_leaf_private_key =
  0x0000000000000000000000000000000000000000000000000000000000000005
counter_0_hmac_sha256_output =
  0xfd90c57fe6b814ea57268d16153d1c86312344f3e5e77ec22630ad48e6e9b96c
counter_0_result = rejected
kdf_counter = 1
hmac_sha256_output =
  0xae52983668004e406e69bfc4a7acfa9765c032128ee6705566e0eb44bde2061a
reduced_scalar =
  0x0652983668004cdb6e69bfc4a7acfa9d5829af10e9e4d238e8759be17c9db13f
viewing_key =
  0x01ad67c997ffb3359196403b585305625f57635ce102dff935f1066031289bf0
public_key_x =
  0x04366caa68f40c9467a805b2646bcca3ac60c320c165564f69bc2de4b668e7ed
```

Negative tests MUST also verify rejection of:

- an account leaf scalar outside its signing curve's valid range;
- variable-width or little-endian encodings;
- a context of any length other than 116 bytes;
- a caller-selected domain separator or KDF counter;
- a reduced scalar equal to zero or folding to `H`; and
- a candidate public key that does not equal the registered public key.

## Security Considerations (abridged)

The viewing key reveals private STRK20 history and can participate in protocol
computations. It MUST NOT be treated as a harmless read-only API token.
Implementations MUST NOT expose a generic HMAC interface keyed by the account
leaf, permit arbitrary domain separators, or make the private scalar available
to the companion wallet. Changing the account leaf changes the viewing key.
Implementations MUST use constant-time cryptographic libraries where available,
minimize copies of the account leaf and viewing key, and zeroize temporary
secret material.

## History

- 2026-07-16: Initial draft.
- 2026-07-28: Replace the two-profile design with the single
  `account-leaf-v1` profile; remove the dedicated viewing-key HD path and
  deterministic-signature derivation.
