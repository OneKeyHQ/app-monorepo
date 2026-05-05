---
title: Overview
section: Bug Bounty Program
order: 0
---

## Scope

This bug bounty program covers code within the [OneKey GitHub Repository](https://github.com/OneKeyHQ/app-monorepo) that directly impacts the security of OneKey products and users.

Bounties for potential vulnerabilities include, but are not limited to:

* Private key handling, storage, and extraction
* CI/CD workflow and build pipeline vulnerabilities
* Domain hijacking and secrets compromise
* Authorization, authentication, and privilege escalation issues

If a vulnerability resides in the repository and materially affects OneKey's security posture, it may be eligible for a bounty.

_Vulnerabilities that involve external libraries, third-party dependencies, or submodules not authored by the OneKey team will be evaluated on a case-by-case basis. Eligibility and reward amount for such reports are at OneKey's sole discretion._

## Rules

### Responsible Disclosure Policy

Participants must adhere to responsible disclosure practices. **You must not:**

* Publicly disclose a vulnerability before OneKey has confirmed remediation or provided explicit written authorization.
* Exploit a vulnerability beyond the minimum necessary to demonstrate proof of concept.
* Access, modify, or delete data belonging to other users.
* Perform any testing against production systems that could degrade service availability or user experience.
* Engage in social engineering, phishing, or physical attacks against OneKey employees, users, or infrastructure.

Violation of these rules will result in immediate disqualification from the program and forfeiture of any pending bounties. OneKey reserves the right to pursue legal remedies for violations that cause harm.

### Submission Guidelines

All vulnerability reports must be submitted through one of the following channels:

1. **Public disclosure**: Create an issue in the [OneKey GitHub repository](https://github.com/OneKeyHQ/app-monorepo) tagged with the `bug` label.
2. **Private disclosure**: Send an email to **dev@onekey.so** — recommended for high-severity vulnerabilities (P0/P1). Private submissions remain fully eligible for bounties.

All submissions must follow the format defined in the [issue template](https://github.com/OneKeyHQ/app-monorepo/blob/onekey/docs/ISSUE_TEMPLATE.md). Reports must include:

* A clear description of the vulnerability
* Step-by-step reproduction instructions
* A working proof of concept (where applicable)
* An assessment of impact and affected components

Clarity, thoroughness, and quality of documentation will be considered when determining reward amount.

**For high-severity vulnerabilities (P0/P1), we strongly recommend private disclosure.** Public disclosure of critical vulnerabilities without prior coordination may affect eligibility and reward amount.

### Eligible Branches

Submissions must target vulnerabilities present on the `master` branch (the mainnet release branch).

### Evaluation and Severity

Submissions will be evaluated by the OneKey security team using the [OWASP Risk Rating Methodology](https://www.owasp.org/index.php/OWASP_Risk_Rating_Methodology), which considers both **Impact** and **Likelihood**.

**It is at the sole discretion of OneKey to determine:**

* Whether a report qualifies as a valid vulnerability
* The severity classification of the vulnerability
* The bounty amount awarded
* Whether duplicate, overlapping, or derivative reports are eligible

All decisions by OneKey are final and not subject to appeal.

### Bounty Amounts

| Severity | Bounty (USD) |
|----------|-------------|
| **P0** — Critical | Up to $5,000 |
| **P1** — High | Up to $2,500 |
| **P2** — Medium | Up to $1,000 |
| **P3** — Low | Up to $500 |
| **P4** — Informational | Up to $250 |

Bounty amounts within each tier are determined based on:

* **Severity**: The potential impact of the vulnerability if exploited.
* **Likelihood**: The probability that the vulnerability could affect users in practice.
* **Report quality**: Clarity of description, completeness of reproduction steps, and quality of proof of concept.
* **Researcher conduct**: Whether the researcher adhered to responsible disclosure practices and avoided any destructive actions.
* **Originality**: Whether the researcher independently discovered the vulnerability. Reports derived from publicly available information may receive reduced or no bounty.

Higher severity will be awarded to vulnerabilities that could result in loss of funds, compromise of private keys, or an irrecoverable state. However, all valid submissions will be considered.

**OneKey reserves the right to adjust bounty amounts at any time without prior notice. Bounty amounts listed represent maximum values per tier, not guaranteed payouts.**

### Duplicate and Overlapping Reports

* Only the **first valid report** of a given vulnerability is eligible for a bounty.
* If multiple researchers independently report the same or substantially similar vulnerability, the bounty will be awarded to the earliest submission with a sufficient proof of concept.
* OneKey may, at its discretion, award partial bounties for duplicate reports that contribute materially new information.
* Reports describing the same root cause across different attack vectors will be treated as a single vulnerability.

### Ineligible Submissions

The following are **out of scope** for this program:

**Out-of-scope products:**
* Vulnerabilities in other OneKey software tools (e.g., OneKeyJS, purser, tailor, etc.) are not eligible under this program. Such disclosures are welcome but will not receive bounties.

**Out-of-scope vulnerability classes:**
* Attacks requiring compromised keys, keyloggers, intercepted communications, or social engineering.
* Attacks accounted for in the system design (e.g., network spamming, reputation gaming, administrative malfeasance).
* General design critiques or mechanism design feedback (please direct to **dev@onekey.so**).
* Clickjacking on pages with no sensitive actions.
* CSRF on unauthenticated forms or forms with no sensitive actions.
* Attacks requiring MITM or physical access to a user's device.
* Attacks requiring an already-compromised victim device.
* Known vulnerable libraries without a working proof of concept demonstrating exploitability in the OneKey context.
* CSV injection without a demonstrated attack vector.
* Any activity that could disrupt service availability (DoS/DDoS).
* Content spoofing or text injection without a demonstrated attack vector or ability to modify HTML/CSS.
* Rate limiting or brute-force issues on non-authentication endpoints.
* Vulnerabilities affecting only outdated browsers (more than 2 stable versions behind the latest release).
* Software version disclosure, banner identification, or descriptive error messages/headers (e.g., stack traces, server errors).
* Public zero-day vulnerabilities patched within the last 1 month — evaluated case by case.
* **Vulnerabilities whose exploit chain fundamentally relies on external zero-day, 1-day, or n-day vulnerabilities** (i.e., in systems not developed or controlled by OneKey, including operating systems, frameworks, dependency libraries, hardware, etc.). OneKey reserves the right to reduce the bounty or invalidate such reports.
* Tabnabbing.
* Open redirects — unless additional security impact can be demonstrated.
* Issues requiring unlikely or impractical user interaction.
* Perceived security weaknesses without demonstrated impact (e.g., missing best practices, functional bugs without security implications).
* Vulnerabilities already known to the OneKey team or currently being remediated.
* Vulnerabilities discovered through automated scanning tools without manual verification and a clear proof of concept.

### Legal Safe Harbor

OneKey will not pursue legal action against researchers who:

* Act in good faith and comply with this program's rules
* Avoid privacy violations, data destruction, and service disruption
* Report vulnerabilities through the designated channels
* Do not publicly disclose vulnerabilities prior to OneKey's confirmation of remediation

This safe harbor does not extend to activities that violate applicable law or that cause harm to OneKey, its users, or third parties.

### Program Terms

* OneKey reserves the right to modify, suspend, or terminate this bug bounty program at any time without prior notice.
* Participation in this program does not create an employment, contractor, or agency relationship with OneKey.
* Bounties are paid at OneKey's discretion and are subject to applicable tax obligations of the recipient.
* By submitting a report, the researcher grants OneKey an unrestricted, perpetual license to use the report and any associated materials for the purpose of improving OneKey's security.
* OneKey may publicly acknowledge researchers (with their consent) but is not obligated to provide public credit.
* All disputes arising from this program will be governed by the laws of the jurisdiction in which OneKey is incorporated.
