# Changelog

## [Unreleased]

### CLAUDE.md keeps this repo's own rules

- The rules every rljson repo shares (coverage, pinning, docs, releases,
  reviews) come with the rljson DNA: `doc/guides/rljson-guide.md` and
  `doc/guides/for-ai/rljson-review-guide.md`. `CLAUDE.md` no longer repeats
  them and no longer describes the old `gg one` workflow.

## [1.0.9]

### Developed in gg tickets

- **Developed in gg tickets.** The repo carries the rljson DNA (`@rljson/dna-rljson`): gg's `/gg-*` skills, the guides and the quick check (`.github/workflows/quick_check.yaml`).
- **Pull requests are checked by the quick check** (`gg one did commit`: every commit went through gg's local lint, tests and coverage). `Build and Test` runs on `main` after the merge.
- **`install-conformance-tests.js`** takes the conformance tests from a linked sibling checkout, which has no `dist/`, by running that checkout's `deploy-conformance-tests.js`.
- **`tsconfig.json` lists `node` in `types`:** TypeScript 6 includes no `@types` by default.
- **vitest also runs `test/**/*.test.ts`,** where gg's release writes the version test.
- **Dependencies raised to their newest versions** (TypeScript 6 among them).

### Releases go through gg

**What changed for contributors.** The CI no longer publishes:
`.github/workflows/publish.yml` is disabled, and a release happens only when
the owner runs `gg one do publish`, which merges first and uploads only what
`main` holds (`--merge-only` merges without a release). CLAUDE.md describes
the whole workflow through gg — `gg one do create ticket`, `gg one do
commit`, `gg one do push`, `gg one do publish`. The scripts gg replaces —
`create-branch.js`, `push-branch.js`, `wait-for-pr.js`, `publish-to-npm.js`,
`add-version-tag.js` — are removed.

## [0.0.1]

Initial commit.
