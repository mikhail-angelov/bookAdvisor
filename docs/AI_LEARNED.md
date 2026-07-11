## 2026-07-11 — Rutracker mojibake cleanup

### Goal

Diagnose and repair Rutracker crawler records where Cyrillic titles look like low-byte control-character text such as `5;8= 52`.

### Golden path

1. Identify corrupted rows by scanning text fields for control characters `\u0010-\u001f` in `books`.
2. Check `user_annotations` before deleting bad `books` rows; do not delete annotated books.
3. Fix the parser path first: avoid re-decoding already-decoded Cyrillic strings, decode direct `fetch` responses from bytes, and run detail crawls through the shared decoded-HTML helper.
4. Delete corrupted, unannotated `books` rows so the next successful crawler cycle recreates them with the corrected parser.
5. Patch the running container or deploy the fixed image before the next crawl.

### Verification

Confirmed on `5.188.25.37` that the repair deleted only unannotated corrupted rows and a post-check returned `{"badRows":0,"total":18242}`.

### Failure pattern avoided

Prevents double-decoding Unicode Cyrillic HTML as `latin1` bytes plus `windows-1251`, which transforms titles like `Бегин Лев - Новый каменный век` into control-character mojibake.

### Ruled-out approaches

- Tried refetching damaged topic pages through server FlareSolverr; failed because Rutracker requests intermittently returned `ERR_CONNECTION_CLOSED`, timeout, or Chrome error HTML.
- Tried reconstructing titles from low bytes; rejected because the mapping loses information and produces ambiguous punctuation, digits, and Latin text.

### Notes

The fastest safe data repair is deletion plus re-crawl when bad rows have no user annotations.
