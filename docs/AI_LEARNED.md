## 2026-07-11 — Rutracker mojibake cleanup

### Goal

Diagnose and repair Rutracker crawler records where Cyrillic titles look like low-byte control-character text such as `5;8= 52`.

### Golden path

1. Identify corrupted rows by scanning text fields for control characters `\u0010-\u001f` in `books`.
2. Check `user_annotations` before deleting bad `books` rows; do not delete annotated books.
3. Keep `crawler/fetcher.ts` as a raw download/storage boundary: do not run `iconv` there. Store byte responses as reversible `latin1` text and keep FlareSolverr response strings unchanged.
4. Decode only in `crawler/parser-service.ts`, immediately before parsing raw crawl records into `books`. The decoder must leave already-decoded Cyrillic strings unchanged.
5. Delete corrupted, unannotated `books` rows so the next successful crawler cycle recreates them with the corrected parser.
6. Delete corrupted `crawl.db` records too when their stored `html_body` already contains low-byte control-character mojibake; those pages need to be re-downloaded.
7. Patch the running container or deploy the fixed image before the next crawl.

### Verification

Confirmed on `5.188.25.37` that the repair deleted only unannotated corrupted `books` rows and a post-check returned `{"badRows":0,"total":18242}`. A full scan of `crawl.db` then deleted corrupted detail crawl records and returned `remainingBadRows: 0`.

### Failure pattern avoided

Prevents double-decoding Unicode Cyrillic HTML as `latin1` bytes plus `windows-1251`, which transforms titles like `Бегин Лев - Новый каменный век` into control-character mojibake.

### Ruled-out approaches

- Tried refetching damaged topic pages through server FlareSolverr; failed because Rutracker requests intermittently returned `ERR_CONNECTION_CLOSED`, timeout, or Chrome error HTML.
- Tried reconstructing titles from low bytes; rejected because the mapping loses information and produces ambiguous punctuation, digits, and Latin text.

### Notes

The fastest safe data repair is deletion plus re-crawl when bad `books` rows have no user annotations. Raw stored crawl data is useful only if it has not already been irreversibly transformed into low-byte mojibake.

## 2026-07-14 — Diagnose selective proxy tunnel timeouts

### Goal

Determine whether a crawler proxy failure is in mproxy, Docker, or the client access network.

### Golden path

1. Test each proxy protocol with explicit credentials and `ALL_PROXY=""`: plain HTTP, HTTPS proxy with `--proxy-insecure` for a self-signed certificate, and SOCKS5 with `--socks5-hostname`.
2. Run the same checks from the proxy host, from a separate external host, and from the affected local network.
3. Compare results before changing proxy code. If the proxy host and an independent external host pass all protocols but the affected network fails only plaintext HTTP CONNECT and SOCKS5, the proxy service is healthy.
4. Use the TLS-wrapped HTTPS proxy where compatible while the affected network is investigated. It encrypts the proxy protocol itself, unlike plaintext HTTP CONNECT and SOCKS5.

### Verification

Authenticated HTTP, HTTPS, and SOCKS5 checks passed both on the mproxy host and from an independent external host. From the affected local network, the HTTPS proxy returned `200`, while plain HTTP CONNECT and SOCKS5 timed out after authentication. Switching Compose to `network_mode: host` did not change the result.

### Failure pattern avoided

Avoids repeatedly changing mproxy or Docker networking when a local router, endpoint security product, corporate network, or ISP can inspect and selectively drop plaintext proxy protocol traffic. Application-aware filtering can recognize SOCKS5 and HTTP CONNECT, whereas TLS hides those protocol messages unless the network performs TLS interception.

### Ruled-out approaches

- Tried replacing Docker published ports with `network_mode: host`; failed because the same local HTTP/SOCKS timeouts remained.
- Tried replacing the custom SOCKS5 implementation with a maintained Go library; failed to change the selective local-network behavior while independent external tests passed.

### Notes

To confirm the network hypothesis, repeat the plaintext tests over a mobile hotspot or other access network, or capture packets on the proxy host and verify that success replies leave the server without being acknowledged by the affected client.
