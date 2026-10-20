# Repository instructions

## Bilingual technical documentation

The project owner requires Portuguese and English technical documentation to remain current together for every improvement or correction.

- Portuguese: `docs/TECHNICAL.md` (keep the existing path).
- English: `docs/TECHNICAL.en.md`.
- For every improvement or fix, update both documents in the same change/commit. Update affected sections and add equivalent entries to the maintenance record in section 15 of both files.
- Preserve matching section numbers, technical meaning, formulas, configuration values, examples, limitations, project credits and documentation revision dates. Translate prose and diagrams; keep code identifiers, commands, JSON keys and production UI labels unchanged.
- Keep reciprocal language links and the README links working. When adding a section, add its equivalent to both versions.
- Documentation-only corrections and translations also require equivalent updates in both documents; avoid leaving a correction in just one language.
- Routine daily JSON observations do not require documentation edits unless they change the schema, workflows, rules, documented baseline or behavior.
- Before committing, review both versions for parity and verify changed relative links. Do not claim an automated translation or semantic parity check exists: this review is manual.

Maintain the credit **Anderson Tagata — ATTecnologies, 2026** in both versions. Keep the production UI in English.
