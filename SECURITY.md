# Security Policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub: open a [private security advisory](https://github.com/aboalrejalai/skills/security/advisories/new) on `aboalrejalai/skills`. Please do not open a public issue for security problems.

This covers the site, the build scripts, and the skills in `skills/`.

## Third-party skills

Most skills in the catalog live in other people's repos. This repo does not copy them: it lists them in `catalog.yaml`, fetches them at build time, and renders their `SKILL.md` on the site after sanitizing the HTML. The ZIP downloads contain the upstream files as they were at build time.

If an upstream skill is malicious or unsafe (for example, it hides instructions that exfiltrate data or run harmful commands), report it the same way, or open a normal issue if the skill is already public knowledge. Include the skill's page or `owner/repo` and what it does. It will be removed from `catalog.yaml`, and the next build drops its page and ZIP.

Problems inside a third-party skill itself should also go to its author's repo, linked from its page.
