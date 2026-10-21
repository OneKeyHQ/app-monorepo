# STRK20 (starknet-privacy) deployment facts

Collected 2026-09-17. Values marked "live" were read from public Starknet RPC
(`starknet_getClassHashAt`, `starknet_getClass`, `starknet_call`) by us; the
pool addresses themselves originate from third-party GitHub issues and were
confirmed by checking that the class at each address exposes `apply_actions`,
`get_public_key`, `get_enc_private_key`, `get_fee_amount`, `get_fee_collector`.

| Parameter | Mainnet | Sepolia |
|---|---|---|
| Pool address | `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a` (starkience/strk20-hackathon #195) | `0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91` (starkware-libs/starknet-privacy #956) |
| Pool class hash (live) | `0x67dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d` | `0x6d163f2b27df0f53c5b0d019366261ba8034af1bef949dee920a60fe58bcf83` |
| `get_version()` (live) | `2.0` | `2.1` |
| `get_fee_amount()` (live) | 6 STRK | 2 STRK |
| `is_paused()` (live) | false | false |
| Screener public key (live) | `0x501cc452e5a4370e2f0879c9a863b3efc915005817487460b23a8d6ef88fdb2` | `0x62f1e7ca586cbc15b558550be96244874c8dd3e4a50369a6858b29c1e51b552` |
| Auditor public key (live) | `0x01eed60b8d483b3bede62d1cc0f32874aea30747e6943437c858359b41801bf7` | `0x01d17f98be07e99713265714699a5c40ccbf7b50c950fb7a2abd81846fcdfbb2` |
| Fee collector (live) | `0x0d79041634625e5288296fbc648088788710ba44903a3a49468a66567749e77` | `0x03e6c6f41d833ec5e7d38e6007df5b0ab6b48bc4c2d3dbeac1ed665456ae4766` |
| Discovery service URL | `https://discovery.nodes.starknet.org` (StarkNet-hosted; live-verified 2026-10-15: `/health` OK at mainnet head with 5s lag, `/ohttp-keys` byte-identical to the pinned config, and an OHTTP `discoverNotes` round trip through the vendored SDK succeeded in ~320 ms) | none; StarkNet runs no Sepolia infra |
| Proving service URL | Starkscan REST prover `https://api.starkscan.co/v1/SN_MAIN/prove` (API key, async job; adapter: `StarkscanProvingService`) | none |
| OHTTP gateway / key config | gateway = discovery URL; pinned key config (hex, length-prefixed) `0x00290000209e19bba88f0c5f4f10913377a4367265bdd59b7d435ee83cba3329f35e263939000400010001` = key id 0, DHKEM X25519, HKDF-SHA256, AES-128-GCM; no relay offered. Live-verified 2026-10-19 with the React Native suite (`@panva/hpke-noble`, pure JS): encapsulation and decapsulation interoperate with the gateway, and inner responses carry no `Content-Encoding` even when the inner request asks for gzip (checked on `/health` and a small `/v1/history` error body only) | none |
| Discovery limits | 1000 requests / 5 min per client IP (429, back off and retry); request body cap 100 KB; 503 `SERVICE_UNAVAILABLE` / `RPC_UNAVAILABLE` retryable | — |
| Token allowlist | none on-chain (wallet decides) | none |
| AVNU paymaster | `https://starknet.paymaster.avnu.fi` | `https://sepolia.paymaster.avnu.fi` |

## Notes

- SDK release `PRIVACY-0.14.3-RC.8` tests assert pool version `2.1`. Mainnet
  runs `2.0`. Nobody publishes a "mainnet runs RC.N" mapping; confirm with
  StarkWare before assuming the current SDK matches the mainnet pool.
- Endpoint status after talking to the StarkNet team (2026-10-14/15): they run
  no Sepolia infrastructure; mainnet proving is Starkscan's prover (operator
  issued API key, `prove` scope, no published pricing, no OHTTP); mainnet
  discovery was "for you to run" until we said we would not operate one, after
  which they stood up the hosted instance above. The operator's own snippet
  passes only `publicKeyConfig`, no `relayUrl`, so encapsulated requests go
  straight to the gateway: content is encrypted to the gateway key but the
  operator sees the client IP. OneKey will not self-host (decision 2026-09-17).
- The Starkscan REST adapter now exists in the vendored SDK
  (`StarkscanProvingService`, async job with `Idempotency-Key`, 202 + poll,
  wired via `provingKind: 'starkscan'`). The only remaining blocker is the
  Starkscan API key in remote config. Discovery needs no API key.
- Starkscan live probe (2026-10-15): the docs page still says the relay routes
  are "not registered at all", but `/v1/SN_MAIN/prove` and `/prove/{jobId}`
  answer 401 `unauthorized` while unknown paths answer 404, so the routes exist
  behind auth. Running `StarkscanProvingService` against the live API with a
  bogus key yields `StarkscanProverError` code `unauthorized`, status 401. CORS
  preflight allows `X-Starkscan-Api-Key` and `Idempotency-Key` from any origin.
- Starkscan facts that shape the client: a `prove`-scope key is issued by the
  operator only after a builder is approved; budgets are per key (concurrency
  and daily volume, numbers set at provisioning). The allowed distance of
  `block_id` from head is prover policy with no published number ("if the
  prover reports that the block is too recent, repin to an older explicit
  block"); we prove at `latest - 9`, untested against it. Starkscan never
  stores `error.message` / `error.data`: they arrive only on the first terminal
  poll, after which only the numeric code remains. A sanctions-screening
  rejection is passed through, and the screener's deposit attestation is
  relayed verbatim under `additional_data.signature`.
- AVNU paymaster documents `apply_action` / `invoke_and_apply_action` types and
  `sponsored_private` fee mode (avnu-labs/paymaster `docs/private-transactions.md`);
  sponsored mode needs an API key from `portal.avnu.fi`, gasless mode does not.
