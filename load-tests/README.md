# ZigScan API Load Tests

These load tests use [k6](https://k6.io/) to exercise the most important read routes of the ZigScan API.  
They assume a running instance of the API (local or remote) with valid API-key access.

## Prerequisites

- Install the k6 CLI (see [k6 installation docs](https://k6.io/docs/get-started/installation/))
- Ensure the ZigScan API is reachable from the machine running the tests
- Gather sample data to target (account and contract addresses that exist)

## Running the tests

```bash
BASE_URL="https://your-api-host/api/v2" \
API_KEY="your-api-key" \
ACCOUNT_ADDRESS="zig1..." \
CONTRACT_ADDRESS="zig1..." \
k6 run load-tests/zigscan-load.test.js
```

Environment variables:

- `BASE_URL` (default `http://localhost:3000/api/v2`)
- `API_KEY` (optional, but recommended for production-like behaviour)
- `ACCOUNT_ADDRESS` and `CONTRACT_ADDRESS` (optional; if omitted, account/contract routes are skipped)

## Scenarios

- `smoke` — 1 VU looping through every configured route for 1 minute; verifies health
- `ramping` — ramps arrival rate from 5 → 60 requests/sec before a cool-down, stressing the API

## Output & thresholds

The script enforces the following thresholds:

- 95th percentile latency under 750 ms
- 99th percentile latency under 1.5 s
- Checks (HTTP 2xx responses) above 95 % pass rate

If any threshold fails, k6 exits with a non-zero status so it can gate CI/CD pipelines.

## Extending

- Add or remove routes in `routes` inside `zigscan-load.test.js`
- Adjust arrival rates/durations in the `options.scenarios` section to mirror real traffic
- Introduce custom checks for payload validation with `check` blocks

