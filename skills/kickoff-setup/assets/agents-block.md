<!-- KICKOFF START -->
## How work ships here

Set up by `kickoff-setup` on <date>. Update with `/kickoff-setup update`.

Every coding task runs down the kickoff line:

```
kickoff-plan → kickoff-implement → kickoff-review → the owner says "اعتمد" → /kickoff-ship
```

- The plan file in `.cursor/plans/` carries the work from station to station.
- Commit work on a feature branch. `main` deploys to production and changes only through a pull request the owner ships with `/kickoff-ship`.
- The `kickoff-using` skill names the specialist each station calls (graphify, Supabase, e2e and this project's `verify-<app>` skill, the reviewers). For a job it does not cover, read the catalog: `~/.agents/skills/kickoff-setup/references/catalog.md`.
- Spec Kit runs only when the owner names it ("Spec Kit", "سبيكت", "speckit"); `kickoff-review` and `/kickoff-ship` still close its work.
- Work in the main session. Use one subagent only for a self-contained side job with bulky output (a broad search, a long log); larger fan-outs only when the owner asks for them by name.
- Write files, commits, pull requests and issues in English; talk to the owner in the language he writes in.
<!-- KICKOFF END -->
