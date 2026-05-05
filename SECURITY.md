# OneKey Bug Bounty Program

🙏 Please report bugs directly to dev@onekey.so or submit through our official page on [BugRap](https://bugrap.io/bounties/OneKey), where our pros have it covered.

## Scope

This bug bounty program extends to all code within the [OneKey Github Repo](https://github.com/onekeyhq/app-monorepo).

Bounties for potential bugs include, but are not limited to:

- Private keys, storage, forensics
- Task, and CI/CD workflow vulnerabilities
- Domain hijacking, Secrets compromise
- Authorization and privilege issues
- More generally, if it lives in the repository\* and affects OneKey's security, it's fair game.

\* There are some components of the OneKey repository that are not created by the OneKey team, but which still could be relevant to overall security. If a bug or exploit makes use of any external libraries or submodules, it will be considered on a case-by-case basis for eligibility.

## Prioritized Focus Areas

- Reports demonstrating how an attacker could extract the secret recovery phrase, private key, or mnemonic from a wallet or device.
- Reports demonstrating how an attacker could make a user's wallet behave in unexpected ways (e.g., signing unintended transactions, displaying incorrect information on confirmation screens).
- Reports demonstrating supply chain attacks or firmware-level compromises.

## Rules

### Demonstrating Impact

All reports must be accompanied with a working proof-of-concept or clear reproduction steps that demonstrates the impact described by the submission. This helps our triage team better investigate your finding, and ensures the full impact of your report is considered for a bounty. Reports which claim to have a specified impact that is later proven false (and does not result in action from the OneKey security team) may be closed as Not-Applicable.

Reports which do not meet our severity threshold for a bounty, but still result in meaningful action amongst our security team, will be closed as resolved when the ticket is added to our backlog.


## Bug Severity and Bounties

Submissions will be evaluated by the OneKey team according to the OWASP risk rating methodology, which grades based on both Impact and Likelihood.

It is at the sole discretion of OneKey to decide whether or not a bug report qualifies for a bounty, and to determine the severity of the issue.

| Severity | Bounty |
|----------|--------|
| P0 (Critical) | $10,000 USD |
| P1 (High) | $5,000 USD |
| P2 (Medium) | $1,000 USD |
| P3 (Low) | $500 USD |
| P4 (Informational) | $250 USD |

Severity levels are based on:

- The severity of the bug.
- The likelihood that the bug will affect users.
- The responsibility of the researcher — did the researcher take destructive action or otherwise harm the functioning of our systems.
- The role of the researcher — was the researcher the first person to discover the bug, or is the bug based on some public information.
- How well the report was written and how easy it is to understand.

Issues reported may or may not constitute a security risk for the OneKey contracts. A higher severity will be awarded to vulnerabilities submitted that could potentially result in either the loss of funds, or a situation in which the contracts arrive in an undesirable state that cannot be rectified through existing contract mechanisms. However, all submitted bugs and vulnerabilities will be considered for prizes.

### OneKey CVSS Scoring Guide

To maintain consistency and transparency, OneKey uses a CVSS-based scoring guide tailored to our hardware wallet and software ecosystem. Below is a simplified version of this guide.

| Metric | Options |
|--------|---------|
| **Attack Vector (AV)** | **Network (N):** The attack can be executed over a network connection (e.g., a user visits a malicious dApp or page that triggers the exploit). |
| | **Physical (P):** The attack requires physical access to the hardware wallet device. |
| | **Local (L):** The attack requires local execution by malicious software/user on the host machine. |
| **Attack Complexity (AC)** | **High (H):** A successful exploit requires overcoming specific conditions beyond the attacker's control, necessitating significant preparatory or execution effort (e.g., exploiting a particular race condition, requiring specific firmware version). |
| | **Low (L):** No specialized access conditions or extenuating circumstances exist. The attack can be reliably and repeatedly executed. |
| **Scope (S)** | **Changed (C):** The vulnerability impacts resources beyond capabilities provided by its authorizing scope (e.g., a dApp is able to extract keys or modify device state without authorization). |
| | **Unchanged (U):** The vulnerability only impacts resources within its authorized scope. |
| **Privileges Required (PR)** | **High (H):** The vulnerability requires a privileged connection or elevated access (e.g., paired Bluetooth device, USB debug access). |
| | **Low (L):** The vulnerability requires the webpage/dApp to be connected to the wallet. |
| | **None (N):** The vulnerability can be exploited without any prior connection or privilege. |
| **User Interaction (UI)** | **Required (R):** Exploitation of the vulnerability requires some form of user interaction (e.g., confirming a transaction, visiting a page). |
| | **None (N):** Exploitation does not require any user interaction (e.g., a supply chain attack on firmware). |
| **Confidentiality Impact (C)** | **High (H):** Attacker can disclose a cryptographic element in custody (private key, mnemonic, encrypted vault, device PIN). |
| | **Low (L):** Attacker can disclose non-critical user information (e.g., account addresses, stored preferences, device metadata). |
| **Integrity Impact (I)** | **High (H):** A cryptographic asset or key security control loses its integrity (e.g., tampering with transaction signing, modifying firmware, spoofing device display content during signing). |
| | **Low (L):** A non-critical user interface element or informational display loses its integrity. |
| **Availability Impact (A)** | **High (H):** Awarded selectively on a case-by-case basis, given OneKey's non-custodial nature. |
| | **Low (L):** The application or device becomes unusable and the issue persists even after rebooting, with the only recovery being reinstallation or device reset. |

Please note that as this guide evolves, changes will only apply to new reports. The OneKey team will not make adjustments retroactively to past bounties.

## First-Actionable vs. First-Submitted Reports

When multiple reports are received for the same vulnerability, the OneKey team will prioritize the **First-Actionable** report over the First-Submitted report. This means that instead of using the submission timestamp alone to determine which report to triage, we will focus on the report that first provides adequate details allowing our team to reproduce and confirm the vulnerability.

In most cases, the First-Submitted report will also be the First-Actionable report. However, this policy ensures that researchers are not penalized for taking the time to submit a thorough and complete report, while another researcher may submit a quick but incomplete report with un-reproducible instructions or missing key information.

## Response Targets

OneKey will make a best effort to meet the following SLAs for researchers participating in our program:

| Type of Response | SLA in Business Days |
|------------------|----------------------|
| First Response | 2 days |
| Time to Triage | 5 days |
| Time to Bounty | 14 days |
| Time to Resolution | Depends on severity & complexity |

We'll try to keep you informed about our progress throughout the process.

## Disclosure Policy

- Please do not discuss this program or any vulnerabilities (even resolved ones) outside of the program without express consent from the OneKey team.
- Researchers who publicly disclose a vulnerability before it has been resolved and without prior consent will be ineligible for a bounty and may be excluded from future participation.
- Coordinated disclosure timelines can be agreed upon on a case-by-case basis with the OneKey security team.

## Scope Exclusions (Ineligible Bugs)

Any vulnerabilities or flaws in other software tools created by OneKey (e.g., OneKeyJS, purser, tailor, etc.) are not eligible. Flaws in these software tools are welcome disclosures but will not be awarded bounties for this bug bounty program.

When reporting vulnerabilities, please consider (1) attack scenario / exploitability, and (2) security impact of the bug. The following issues are considered out of scope:

- Attacks and vulnerabilities that depend on compromised keys or other security flaws outside the OneKey codebase (keyloggers, intercepted communications, social engineering exploits, etc.).
- Attacks requiring a compromised victim device, including attacks requiring the user to install a malicious application, execute malicious scripts, disable device security settings, or jailbreak/root their device.
- Attacks requiring MITM or physical access to a user's device (note: physical attacks on the hardware wallet device itself may still be in scope if they demonstrate a novel hardware vulnerability).
- Attacks that are accounted for in the system design, i.e., Ethereum network spamming, malicious reputation mining, malfeasance in OneKey administration.
- Critiques of the OneKey and overall mechanism design. We welcome suggestions and constructive criticism, and ask that it be directed to dev@onekey.so.
- Vulnerabilities only affecting users of outdated or unpatched browsers (less than 2 stable versions behind the latest released stable version).
- Secret Recovery Phrase / Mnemonic brute-forcing. Reports attempting to brute force seed phrases are not valid or eligible. This exclusion does not apply to reporting legitimate cryptographic weaknesses in OneKey's seed phrase generation.
- Reporting a leaked token or credential without validation. Reporters must validate that leaked tokens from our applications are valid and can access sensitive operations. If you cannot confirm this via public documentation, do not attempt to use the token — please report it to our team instead. Note that user API keys or SRPs leaked online are not valid reports.
- Malicious RPC servers. Reports requiring malicious RPCs remain out of scope unless the RPC can impact resources beyond its expected scope (e.g., achieving XSS, tampering with restricted state). Misleading data such as faking balances or transactions remains out of scope.
- Mobile browser issues without security or privacy impact. Mobile browser issues are excluded unless a PoC shows potential user fund loss or impacts critical areas such as user privacy (e.g., fingerprinting), wallet functionality (e.g., confirmation screens, wallet connections), or core browser security features (e.g., address bar, CSP, SOP).
- Mobile browser resource exhaustion / DoS. Reports of sites loaded in the mobile browser that cause the app to crash or become unresponsive are only eligible if the user cannot recover through standard actions (e.g., force closing the app, rebooting, and clearing browser history in settings).
- Third-party plugin or extension vulnerabilities. Report third-party plugin or extension vulnerabilities to the respective developer. If no response after one week, report to us for assistance in contacting them. Note: Third-party plugin reports are marked as informative and are not bounty eligible.
- Perceived security weaknesses without evidence of the ability to demonstrate impact (e.g., missing best practices, functional bugs without security implications, recommended security improvements, etc.).
- Clickjacking on pages with no sensitive actions.
- Cross-Site Request Forgery (CSRF) on unauthenticated forms or forms with no sensitive actions.
- Previously known vulnerable libraries without a working Proof of Concept.
- Comma Separated Values (CSV) injection without demonstrating a vulnerability.
- Any activity that could lead to the disruption of our service (DoS).
- Content spoofing and text injection issues without showing an attack vector / without being able to modify HTML/CSS.
- Rate limiting or brute force issues on non-authentication endpoints.
- Software version disclosure / Banner identification issues / Descriptive error messages or headers (e.g., stack traces, application or server errors).
- Public zero-day vulnerabilities that have had an official patch for less than 1 month will be awarded on a case-by-case basis.
- Tabnabbing.
- Open redirect — unless an additional security impact can be demonstrated.
- Issues that require unlikely user interaction.
- Exploits requiring seed phrase entry. Users are consistently reminded to never provide their seed phrase to anyone. Reports requiring users to act outside of these guidelines are considered out of scope.

## Funding Your Wallet

To experiment with OneKey without using your own ETH, switch your default network to Sepolia test network and use a faucet such as [Infura Faucet](https://www.infura.io/faucet) to get test funds.

## Program Rules

- Please provide detailed reports with reproducible steps. If the report is not detailed enough to reproduce the issue, the issue will not be eligible for a reward.
- Submit one vulnerability per report, unless you need to chain vulnerabilities to provide impact.
- Multiple vulnerabilities caused by one underlying issue will be awarded one bounty.
- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our service. Only interact with accounts you own or with explicit permission of the account holder.