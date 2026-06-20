# Security policy

## Reporting a vulnerability

Report confidentially via GitHub's private security advisory flow:
**Security tab → Advisories → New draft security advisory**.

Do **not** open public issues, discussions, or PRs for security
vulnerabilities. Do not disclose details on social media until a fix
ships and a coordinated disclosure date is agreed.

## What to include

- A clear description of the issue and its impact
- Steps to reproduce, or a minimal proof-of-concept
- Affected versions, commits, or deployments
- Any logs, screenshots, or code paths that help triage
- Your preferred disclosure timeline (default: 90 days)

## Response

- Initial acknowledgement within **7 days**
- Triage and severity assessment within **14 days**
- Fix and coordinated disclosure aligned with severity:
  - Critical: target 30 days
  - High: target 60 days
  - Medium / Low: target 90 days

If the timeline slips, the maintainer will explain why and propose a
revised target.

## Scope

**In scope** — code, configuration, and CI workflows in any repository
under the [@qte77](https://github.com/qte77) account.

**Out of scope:**

- Findings that require physical access, social engineering, or compromised
  developer machines
- Denial-of-service via resource exhaustion against public CI runners
- Vulnerabilities in third-party dependencies (report upstream first; we
  track via Dependabot)
- Best-practice suggestions without a demonstrable security impact

## Supported versions

Unless a repository's README states otherwise, only the latest release on
the default branch receives security fixes. Older tags are not patched.

## Disclosure

The reporter and maintainer agree on a public disclosure date once a fix
is available. We credit the reporter in the GitHub security advisory
unless the reporter requests anonymity. There is no monetary bug bounty.

## Safe harbor

Good-faith security research conducted under this policy will not be
pursued legally. "Good-faith" means: no data exfiltration beyond what is
needed to demonstrate impact, no destruction or modification of data, no
disruption of services for other users, and adherence to the disclosure
process above.
