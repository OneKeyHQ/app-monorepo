# OneKey Bug Bounty Program

This bug bounty program covers code within the OneKey repositories that directly impacts the security of OneKey products and users.

All vulnerability reports must be submitted through one of the following channels:
1. **Private disclosure**: Send an email to [security@onekey.so](mailto:[security@onekey.so]) — recommended for high-severity vulnerabilities. Private submissions remain fully eligible for bounties.
2. **BugRap Platform**: Submit through our official page on [BugRap](https://bugrap.io/bounties/OneKey).

## Scope

| In Scope                     | Repository/URL                                                               |
| :--------------------------- | :--------------------------------------------------------------------------- |
| APP monorepo                 | [OneKey APP Monorepo](https://github.com/OneKeyHQ/app-monorepo)              |
| Firmware (Pro)               | [OneKey Firmware Pro](https://github.com/OneKeyHQ/firmware-pro)              |
| Firmware (Classic 1s)        | [OneKey Firmware Classic_1s](https://github.com/OneKeyHQ/firmware-classic1s) |
| Firmware (Legacy-Deprecated) | [OneKey Firmware](https://github.com/OneKeyHQ/firmware)                      |
| Hardware SDK                 | [OneKey Hardware SDK](https://github.com/OneKeyHQ/hardware-js-sdk)           |
| Websites and Applications    | *.onekey.so                                                                  |

Submissions must target vulnerabilities present on the `master` branch (the main release branch).

## Threat Model & High-Impact Areas

OneKey is a hardware wallet ecosystem. Our primary security concern is the **protection of user assets and cryptographic secrets**. The following threat model defines what we consider high-impact across each product area. Researchers are encouraged to focus on these areas — reports that demonstrate real impact on the threats listed below will receive priority review and higher rewards.

### Wallet & Firmware (Highest Priority)

These are the vulnerabilities we care about most:

| Threat                                     | Examples                                                                                                |
| :----------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| **Seed phrase / mnemonic recovery**        | Extracting full or partial mnemonic from device memory, storage, backups, logs, or side-channel leakage |
| **Private key extraction**                 | Reading private keys from secure element, RAM, flash, or through fault injection                        |
| **Transaction manipulation**               | Signing a different transaction than what is displayed to the user (display mismatch attack)            |
| **PIN / passphrase bypass**                | Unlocking the device or accessing secrets without correct PIN or passphrase                             |
| **Firmware integrity bypass**              | Installing unsigned or tampered firmware, downgrade attacks bypassing rollback protection               |
| **Supply chain attack on firmware update** | MITM or tampering during OTA/USB firmware update process                                                |
| **Secure element bypass**                  | Any method to extract data from or bypass the secure element's protections                              |

### APP (Desktop / Mobile / Browser Extension)

| Threat                                 | Examples                                                                                                   |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **Seed phrase exposure**               | Mnemonic leaked to logs, clipboard, local storage, crash reports, screenshots, or accessible by other apps |
| **Unauthorized transaction**           | Initiating or signing transactions without user confirmation or approval                                   |
| **Address substitution**               | Replacing recipient address during send flow (clipboard hijacking, UI spoofing, memory tampering)          |
| **Bypass of transaction confirmation** | Skipping or auto-approving the user confirmation step                                                      |
| **Key material in memory**             | Private keys or seed phrases persisted in memory longer than necessary, or readable by other processes     |
| **Deeplink / URI scheme abuse**        | Triggering sensitive wallet operations via crafted deeplinks without user consent                          |
| **Extension permission escalation**    | Browser extension gaining access beyond declared permissions                                               |

### Websites & Backend (*.onekey.so)

| Threat                                    | Examples                                                                                                                |
| :---------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **Remote Code Execution (RCE)**           | Command injection, deserialization, SSTI leading to arbitrary code execution on server                                  |
| **Arbitrary file read / write**           | Path traversal, LFI/RFI leading to reading sensitive files (e.g., /etc/passwd, config, keys) or writing arbitrary files |
| **SQL Injection**                         | SQLi leading to data extraction, authentication bypass, or data modification                                            |
| **Authentication / authorization bypass** | Accessing other users' data or admin functionality without proper credentials                                           |
| **SSRF with internal access**             | Server-Side Request Forgery reaching internal services, cloud metadata, or private network                              |
| **Mass user data exposure**               | Endpoints leaking PII or account data of multiple users (IDOR at scale, broken access control)                          |
| **Subdomain takeover**                    | Dangling DNS records on *.onekey.so pointing to unclaimed services                                                      |

### Hardware JS SDK

| Threat                                  | Examples                                                                                   |
| :-------------------------------------- | :----------------------------------------------------------------------------------------- |
| **Command injection via SDK**           | Crafted input to SDK functions leading to arbitrary command execution on host              |
| **MITM between app and device**         | Intercepting or tampering with USB/Bluetooth communication between app and hardware wallet |
| **Malicious firmware delivery via SDK** | Manipulating the SDK to deliver tampered firmware to the device                            |
| **Authentication bypass**               | Bypassing device authentication or pairing verification through the SDK                    |

### What is NOT high-impact

To save both your time and ours, the following do **not** qualify as high-impact even if technically valid:
- Theoretical attacks without working PoC
- Self-XSS or XSS on pages with no session or sensitive data
- Missing security headers without demonstrated exploit chain
- Rate limiting issues on non-critical endpoints
- Scanner output (Nessus, Burp, Nuclei, etc.) without manual validation
- "Best practice" recommendations (e.g., adding CSP, HSTS) without demonstrated attack

## Bounty Amounts

Rewards will be provided according to the rules of this bug bounty program. At the discretion of OneKey, quality, creativity, or novelty of submissions may modify payouts within a given range.

Severity levels are based on:
- **Severity & Impact**: The potential impact of the vulnerability if exploited. Higher severity will be awarded to vulnerabilities that could result in loss of funds, compromise of private keys, or an irrecoverable state.
- **Likelihood**: The probability that the vulnerability will affect users.
- **Report quality**: Clarity of description, completeness of reproduction steps, and quality of proof of concept.
- **Researcher conduct**: Whether the researcher adhered to responsible disclosure practices and avoided destructive actions.
- **Originality**: Whether the researcher independently discovered the vulnerability (reports from public info may receive reduced bounds).

### 1. APP Monorepo (iOS/Android/MacOS/Linux/Windows/Chrome Extension)
|   Severity    | Description                                                                                                                                                          |  Reward (USD)   |
| :-----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: |
| Critical (P0) | Critical severity vulnerabilities will have a significant impact on the security of the project, and it is strongly recommended to fix the critical vulnerabilities. | $1,000 ~ $3,000 |
|   High (P1)   | High severity vulnerabilities will affect the normal operation of the project. It is strongly recommended to fix high-risk vulnerabilities.                          |  $500 ~ $1,000  |
|  Medium (P2)  | Medium severity vulnerability will affect the operation of the project. It is recommended to fix medium-risk vulnerabilities.                                        |   $100 ~ $500   |
|   Low (P3)    | Low severity vulnerabilities may affect the operation of the project in certain scenarios. It is suggested that the project team evaluate whether to fix them.       |    $0 ~ $100    |

### 2. Firmware
|   Severity    | Description                                                                                                                                                          |  Reward (USD)   |
| :-----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: |
| Critical (P0) | Critical severity vulnerabilities will have a significant impact on the security of the project, and it is strongly recommended to fix the critical vulnerabilities. | $3,000 ~ $5,000 |
|   High (P1)   | High severity vulnerabilities will affect the normal operation of the project. It is strongly recommended to fix high-risk vulnerabilities.                          | $1,000 ~ $3,000 |
|  Medium (P2)  | Medium severity vulnerability will affect the operation of the project. It is recommended to fix medium-risk vulnerabilities.                                        |  $100 ~ $1,000  |
|   Low (P3)    | Low severity vulnerabilities may affect the operation of the project in certain scenarios. It is suggested that the project team evaluate whether to fix them.       |    $0 ~ $100    |

### 3. Hardware JS SDK
|   Severity    | Description                                                                                                                                                          |  Reward (USD)   |
| :-----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: |
| Critical (P0) | Critical severity vulnerabilities will have a significant impact on the security of the project, and it is strongly recommended to fix the critical vulnerabilities. | $1,000 ~ $2,000 |
|   High (P1)   | High severity vulnerabilities will affect the normal operation of the project. It is strongly recommended to fix high-risk vulnerabilities.                          |  $500 ~ $1,000  |
|  Medium (P2)  | Medium severity vulnerability will affect the operation of the project. It is recommended to fix medium-risk vulnerabilities.                                        |   $100 ~ $500   |
|   Low (P3)    | Low severity vulnerabilities may affect the operation of the project in certain scenarios. It is suggested that the project team evaluate whether to fix them.       |    $0 ~ $100    |

### 4. Websites and Applications
|   Severity    | Description                                                                                                                                                          |  Reward (USD)   |
| :-----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: |
| Critical (P0) | Critical severity vulnerabilities will have a significant impact on the security of the project, and it is strongly recommended to fix the critical vulnerabilities. | $1,000 ~ $2,000 |
|   High (P1)   | High severity vulnerabilities will affect the normal operation of the project. It is strongly recommended to fix high-risk vulnerabilities.                          |  $500 ~ $1,000  |
|  Medium (P2)  | Medium severity vulnerability will affect the operation of the project. It is recommended to fix medium-risk vulnerabilities.                                        |   $100 ~ $500   |
|   Low (P3)    | Low severity vulnerabilities may affect the operation of the project in certain scenarios. It is suggested that the project team evaluate whether to fix them.       |    $0 ~ $100    |

*(OneKey reserves the right to adjust bounty amounts at any time without prior notice. Bounty amounts listed represent maximum values per tier, not guaranteed payouts.)*


## Report Quality Multiplier

Reward amounts listed in the bounty tables above represent **base values**. A quality multiplier will be applied to the final payout based on the overall quality of the submission:

|   Multiplier    | Criteria                                                                                                                                                                                                   |
| :-------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    **1.2x**     | Exceptional reports that include: clear impact description, effective reproduction steps, root cause analysis, and concise technical writing.                                                              |
| **1.0x** (base) | Standard reports that meet all submission requirements.                                                                                                                                                    |
|    **0.8x**     | Reports that lack one or more of the above quality elements (e.g., unclear impact, missing root cause analysis, or unnecessarily verbose write-ups).                                                       |
|    **0.5x**     | Low-quality reports that do not clearly demonstrate the bug's impact, contain vague or unverifiable technical content, or require significant additional effort from the OneKey security team to validate. |

The quality multiplier is applied at OneKey's sole discretion. We now consider the most effective reports to be **concise, containing only a reproducer and the necessary artifacts** to help us validate and route the issue.

## AI-Generated Reports Policy

**Submissions that are generated in whole or in substantial part by AI (including LLMs such as ChatGPT, Claude, Gemini, etc.) are not accepted.**

We have observed that AI-generated vulnerability reports frequently contain hallucinated technical details, fabricated vulnerability triggers, and inflated impact assessments that do not reflect actual security risks. These low-signal submissions create noise that undermines the efficiency of our security program.

**Please, stop using AI to write your reports.** Writing reports in your native language is acceptable — we prefer that over AI-translated or AI-generated text that may obscure technical details. Reports identified as AI-generated will be closed without review and may count against the submitter's track record.

Acceptable use of AI is limited to:
- Using AI as a **tool during research** (e.g., code analysis, fuzzing, pattern detection) — the vulnerability itself must be real and independently verified.
- Using AI for **minor language corrections** (e.g., grammar/spell check) on a report you wrote yourself.

AI-generated reports are identified by characteristics including but not limited to: generic boilerplate language, hallucinated function names or code paths, inability to answer follow-up questions about the reported vulnerability, and submissions that describe theoretical impacts without concrete proof.

## Rules & Guidelines

### Responsible Disclosure Policy

Participants must adhere to responsible disclosure practices. **You must not:**
- Publicly disclose a vulnerability before OneKey has confirmed remediation or provided explicit written authorization.
- Exploit a vulnerability beyond the minimum necessary to demonstrate proof of concept.
- Access, modify, or delete data belonging to other users.
- Perform any testing against production systems that could degrade service availability or user experience.
- Engage in social engineering, phishing, or physical attacks against OneKey employees, users, or infrastructure.
- Use a scanner for large-scale scanning. (If the business system or network becomes unavailable due to scanning, it will be handled according to relevant laws.)
- Conduct destructive testing. Vulnerability testing is strictly limited to PoC (proof of concept). If harms are caused inadvertently during testing, report it immediately and detail any sensitive operations (e.g., deletion, modification) performed during the test.
- Use excessively aggressive payloads if preventable. When testing XSS, avoid modifying the page directly, continuously popping up message boxes (log is recommended for XSS verification), or stealing Cookies/user information (for blind XSS testing, please use DNSLog). If an aggressive payload was accidentally used, please delete it in time.
- **Use threats, coercion, or extortion** to pressure OneKey into expediting report review, increasing bounty payouts, or taking any other action. Any attempt to leverage a vulnerability as a threat — including threatening to publicly disclose, sell, or exploit the vulnerability — will result in immediate disqualification and may be referred to law enforcement.
- **Publicly disclose a report without authorization.** All reports must remain confidential until OneKey has confirmed remediation and provided explicit written consent for disclosure. Unauthorized public disclosure — regardless of the researcher's intent or frustration with the review timeline — will result in forfeiture of all bounties and permanent exclusion from the program.

Violation of these rules will result in immediate disqualification from the program and forfeiture of any pending bounties. OneKey reserves the right to pursue legal remedies for violations that cause harm.

### Submission Guidelines & Reporting Rules

All submissions must follow the format defined in the issue template. Reports must include:
- A clear description of the vulnerability
- Step-by-step reproduction instructions, which may include screenshots, videos, scripts, etc.
- A **working proof of concept** (required, not optional)
- An assessment of impact and affected components
- Root cause analysis (what code or logic causes the vulnerability)

To ensure our triage team can focus on the most critical threats, we require **higher-quality proof** for all severity tiers. Reports must include concrete proof that a bug exists — not theoretical analysis or scanner output alone.

**Effective reports are concise.** Document only what is necessary: the reproducer, the artifacts to validate the issue, and the security impact. Do not submit lengthy AI-style research papers. We value reports that document:
- **What**: the vulnerability and affected component
- **How**: step-by-step reproduction with working PoC
- **Why**: the root cause and security impact

Reports which claim to have a specified impact that is later proven false (and does not result in action from the OneKey security team) may be closed as Not-Applicable. Reports which do not meet our severity threshold for a bounty, but still result in meaningful action amongst our security team, will be closed as resolved when the ticket is added to our backlog.

### Multiple Reports (Duplicate and Overlapping Reports)

In case of multiple reports about the same issue, OneKey will reward the earliest valid and actionable submission (First-Actionable). This means we prioritize the report that first provides adequate details allowing our team to reproduce and confirm the vulnerability.

Only the **first valid report** of a given vulnerability is eligible for a bounty. Reports describing the same root cause across different attack vectors or multiple vulnerabilities caused by one underlying issue will be awarded one/single bounty.

OneKey may, at its discretion, award partial bounties for duplicate reports that contribute materially new information.

## Evaluation and Severity

Submissions will be evaluated by the OneKey security team using multiple criteria. It is at the sole discretion of OneKey to determine whether a report qualifies as a valid vulnerability, the severity classification, the bounty amount awarded, and whether derivative reports are eligible. All decisions by OneKey are final.

### Rating Standards

We utilize the following standards to assist in evaluating vulnerabilities:
1. **OWASP Risk Rating Methodology**: Considers both **Impact** and **Likelihood**.
2. **CVSS 3.1 Standards**: Will be used for standard vulnerability rating ([CVSS3.1](https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator)).

*(Note: As this guide evolves, changes will only apply to new reports. The OneKey team will not make adjustments retroactively to past bounties.)*

## Out of Scope

The following issues are considered **out of scope**:

**AI-Generated Reports**

**Attack Vectors & Exploits:**
- Attacks and vulnerabilities that depend on compromised keys or other security flaws outside the OneKey codebase (keyloggers, intercepted communications, social engineering exploits, etc.).
- Attacks requiring a compromised victim device, including attacks requiring the user to install a malicious application, execute malicious scripts, disable device security settings, or jailbreak/root their device.
- Attacks requiring MITM or physical access to a user's device (note: physical attacks on the hardware wallet device itself may still be in scope if they demonstrate a novel hardware vulnerability).
- Vulnerabilities whose exploit chain fundamentally relies on leveraging an external 0-day, 1-day, or n-day vulnerability (i.e., in systems not developed/controlled by OneKey, operating systems, frameworks, dependency libraries, hardware chips, etc.). OneKey reserves the right to reduce the bounty or invalidate such reports.
- Secret Recovery Phrase / Mnemonic brute-forcing. Reports attempting to brute force seed phrases are not valid or eligible. (Does not apply to legitimate cryptographic weaknesses in seed phrase generation).
- Exploits requiring seed phrase entry. Users are consistently reminded to never provide their seed phrase. Reports requiring users to act outside these guidelines are out of scope.

**System Design & Business Logic:**
- Attacks that are accounted for in the system design (e.g., Ethereum network spamming, malicious reputation mining/gaming, administrative malfeasance).
- Any activity that could lead to the disruption of our service availability (DoS/DDoS).
- Issues that require unlikely or impractical user interaction.
- Perceived security weaknesses without evidence of the ability to demonstrate impact (e.g., missing best practices, functional bugs without security implications, recommended security improvements).

**Application & Web Vulnerabilities:**
- Clickjacking on pages with no sensitive actions.
- Cross-Site Request Forgery (CSRF) on unauthenticated forms or forms with no sensitive actions.
- Comma Separated Values (CSV) injection without demonstrating a vulnerability/attack vector.
- Content spoofing and text injection issues without showing an attack vector / without being able to modify HTML/CSS.
- Rate limiting or brute force issues on non-authentication endpoints.
- Software version disclosure / Banner identification issues / Descriptive error messages or headers (e.g., stack traces, application or server errors).
- Tabnabbing.
- Open redirect — unless an additional security impact can be demonstrated.
- Previously known vulnerable libraries without a working Proof of Concept demonstrating exploitability.

**Third-party, Infrastructure & Other Elements:**
- Vulnerabilities that involve external libraries, third-party dependencies, or submodules not authored by the OneKey team will be evaluated on a case-by-case basis. Eligibility and reward amount for such reports are at OneKey's sole discretion.
- Vulnerabilities only affecting users of outdated or unpatched browsers (less than 2 stable versions behind the latest released stable version).
- Public zero-day vulnerabilities that have had an official patch for less than 1 month will be awarded on a case-by-case basis.
- Reporting a leaked token or credential without validation. Reporters must validate that leaked tokens from our applications are valid and can access sensitive operations. User API keys or SRPs leaked online are not valid reports.
- Malicious RPC servers. Reports requiring malicious RPCs remain out of scope unless the RPC can impact resources beyond its expected scope (e.g., achieving XSS, tampering with restricted state). Misleading data such as faking balances or transactions remains out of scope.
- Mobile browser issues without security or privacy impact, or mobile browser resource exhaustion / DoS that user can recover from through standard actions.
- Third-party plugin or extension vulnerabilities. Report third-party plugin or extension vulnerabilities to the respective developer first.
- Vulnerabilities already known to the OneKey team or currently being remediated.
- Vulnerabilities discovered through automated scanning tools (including AI-powered scanners) without manual verification and a clear proof of concept.
- Any vulnerabilities or flaws in other software tools created by OneKey (e.g., OneKeyJS, purser, tailor, etc.) are not eligible. Flaws in these software tools are welcome disclosures but will not be awarded bounties for this bug bounty program.

## Anti-Abuse Policy

OneKey reserves the right to take the following actions against researchers who repeatedly submit low-quality, invalid, or AI-generated reports:

- **Warning**: First-time submission of a low-quality or AI-generated report will result in the report being closed and a warning issued to the submitter.
- **Cooldown**: Researchers who receive two or more warnings within a 90-day period will be placed on a **30-day cooldown**, during which no new submissions will be accepted or reviewed.
- **Suspension**: Researchers who continue to submit low-quality or AI-generated reports after a cooldown period may be **permanently suspended** from the program.

Reports with hallucinated vulnerabilities, vague technical content, or other forms of low-effort noise are treated as spam. Submitting such reports in volume is considered abuse of the program.

OneKey tracks submission quality history per researcher. A consistent track record of high-quality submissions will be considered favorably when evaluating borderline reports. Conversely, a history of low-quality submissions may result in stricter scrutiny of future reports.

## Legal Safe Harbor

OneKey will not pursue legal action against researchers who:
- Act in good faith and comply with this program's rules
- Avoid privacy violations, data destruction, and service disruption
- Report vulnerabilities through the designated channels
- Do not publicly disclose vulnerabilities prior to OneKey's confirmation of remediation

This safe harbor does not extend to activities that violate applicable law or that cause harm to OneKey, its users, or third parties.

## Funding Your Wallet

To experiment with OneKey without using your own ETH, switch your default network to Sepolia test network and use a faucet such as [Infura Faucet](https://www.infura.io/faucet) to get test funds.

## Program Terms

- OneKey reserves the right to modify, suspend, or terminate this bug bounty program at any time without prior notice.
- Participation in this program does not create an employment, contractor, or agency relationship with OneKey.
- Bounties are paid at OneKey's discretion and are subject to applicable tax obligations of the recipient.
- By submitting a report, the researcher grants OneKey an unrestricted, perpetual license to use the report and any associated materials for the purpose of improving OneKey's security.
- OneKey may publicly acknowledge researchers (with their consent) but is not obligated to provide public credit.
- All disputes arising from this program will be governed by the laws of the jurisdiction in which OneKey is incorporated.
