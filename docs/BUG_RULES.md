---
title: Overview
section: Bug Bounty Program
order: 0
---


## Scope

This bug bounty program extends to all code within the [OneKey Github Repo](https://github.com/OneKeyHQ/app-monorepo).

Bounties for potential bugs include, but are not limited to:
* Private keys, storage, forensics
* Task, and CI/CD workflow vulnerabilities
* Domain hijacking, Secrets compromise
* Authorization and privilege issues

More generally, if it lives in the repository* and affects OneKey's security, it's fair game.

_\* There are some components of the OneKey repository that are not created by the OneKey team, but which still could be relevant to overall security. If a bug or exploit makes use of any external libraries or submodules, it will be considered on a case-by-case basis for elegibility._

## Rules


### Submission Guidelines

All bugs reported must be done through the creation of an issue in the OneKey github repo, or _if the submitter wishes to disclose privately, or to remain anonymous_ by an email sent to dev@onekey.so . Private submissions are still eligible for a bounty.

Unless there is a specific reason for a private disclosure, bugs should be submitted as issues on the OneKey GitHub repository, and tagged with the 'bug' label.

It is requested that all submissions follow the format defined in the [issue template](https://github.com/OneKeyHQ/app-monorepo/docs/ISSUE_TEMPLATE.md) -- clarity of description and thoroughness of documentation will be a consideration for reward amount, in addition to impact and likelihood.

In the case of private bug disclosure, all relevant materials should be sent in email to `dev@onekey.so` -- and should follow the same template as a public issue.

Once submitted, the issue will be responded to, verified, accepted, and rewarded accordindly.

### Submission Branches
Participants in the program are free to submit bugs on branches in the OneKey codebase:
* against the `master` branch which will be tagged as the mainnet release for deployment

### Bug Severity and Bounties
In the same manner as the [Ethereum Bug Bounty Program](https://bounty.ethereum.org/), submissions will be evaluated by the OneKey team according to the [OWASP risk rating methodology](https://www.owasp.org/index.php/OWASP_Risk_Rating_Methodology), which grades based on both _Impact_ and _Likelihood_.

It is at the *sole discretion of OneKey* to decide whether or not a bug report qualifies for a bounty, and to determine the severity of the issue

Severity levels:

* *Note*: Up to $500 USD (min. $100)
* *Low*: Up to $2,000 USD (min. $500)
* *Medium*: Up to $5,000 USD (min. $2,000)
* *High*: Up to $10,000 USD (min. $5,000)
* *Critical*: Up to $20,000 USD (min. $10,000)

Issues reported may or may not constitute a security risk for the OneKey contracts. A higher severity will be awarded to vulnerabilities submitted that could potentially result in either the loss of funds, or a situation in which the contracts arrive in an undesirable state that cannot be rectified through existing contract mechanisms, such as 'emergency mode' or through a network upgrade. However, all submitted bugs and vulnerabilities will be considered for prizes.

### Ineligible Bugs

Any vulnerabilities or flaws in other software tools created by OneKey (e.g. OneKeyJS, purser, tailor, etc.) are not eligible. Flaws in these software tools are welcome disclosures, but will not be awarded bounties for this bug bounty program.

Additional examples of ineligible bugs:
* Attacks and vulnerabilities that depend on compromised keys or other security flaws outside the OneKey codebase (keyloggers, intercepted communications, social engineering exploits, etc.).
* Attacks that are accounted for in the system design, i.e. Ethereum network spamming, malicious reputation mining, malfeasance in OneKey administration.
* Critiques of the OneKey and overall mechanism design. We welcome suggestions and constructive criticism, and ask that it be directed to dev@OneKey.so .