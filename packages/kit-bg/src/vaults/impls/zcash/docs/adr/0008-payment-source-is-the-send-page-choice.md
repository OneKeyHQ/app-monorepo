# The payment source is the send page's choice

Status: accepted, 2026-09-27 product alignment. Supersedes the transparent-first
paragraph of ADR 0007.

The transparent-first account preference is removed. The source a payment
spends is exactly the one chosen on the send page: a private pool spends only
that pool, and transparent spends only transparent funds.

The preference and the source picker both decided which funds a payment used,
and they disagreed whenever a private pool was chosen with the preference on:
the page named one pool while the transaction could spend another, and no
single spendable figure matched both what the user could enter and what Max
would send. One control removes the conflict: every source shows its own
spendable amount, and Max sends exactly that.

A payment larger than any single source now needs the funds moved first, for
example with Shield All. Transparent funds can still pay a supported Unified
Address directly, as ADR 0007 describes.

Which sources the page offers depends on where the send started:

| Started from | Sources offered | Default |
| --- | --- | --- |
| The transparent tab | Transparent only, no picker | Transparent |
| A private pool's tab | That pool and transparent | That pool |
| Anywhere else | Every pool that can pay the recipient | By recipient type |

A transparent tab never offers private funds: its change goes back to
transparent, and the page would otherwise spend funds the user was not looking
at. If a private pool's balance cannot be loaded, it stays selected and the page
offers a retry; it never falls back to transparent on its own.

A TEX address (ZIP-320) accepts transparent funds only, so for such a recipient
the page offers transparent alone, whatever the entry point. Paying one from
private funds, as Zashi does by first moving them through a temporary
transparent address, is not supported yet.
