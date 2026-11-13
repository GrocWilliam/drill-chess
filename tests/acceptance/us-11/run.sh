#!/usr/bin/env bash
# US-11 acceptance tests: reset a password by mail (HTTP form posts, mail outbox, browser flow on a phone).
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set);
# SMTP_URL is unset and MAIL_OUTBOX points to a temporary folder, so no real mail server is ever reached.
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-11/http.test.mjs tests/acceptance/us-11/browser.test.mjs
