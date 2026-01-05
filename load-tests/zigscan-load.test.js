import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000/api/v2';
const API_KEY = __ENV.API_KEY ?? '';
const ACCOUNT_ADDRESS = __ENV.ACCOUNT_ADDRESS;
const CONTRACT_ADDRESS = __ENV.CONTRACT_ADDRESS;

const headers = API_KEY
  ? {
      Authorization: `Bearer ${API_KEY}`,
    }
  : {};

const baseRoutes = [
  { name: 'get_supply', path: '/supply' },
  { name: 'get_zig_market', path: '/zig/market-data' },
  { name: 'get_zig_staking_pool', path: '/zig/staking-pool' },
  { name: 'get_zig_price_data', path: '/zig/price-data?days=24hr' },
  { name: 'get_accounts_total', path: '/accounts/total' },
  { name: 'list_tokens', path: '/tokens?limit=25&offset=0' },
];

if (ACCOUNT_ADDRESS) {
  baseRoutes.push(
    { name: 'get_account_details', path: `/account/details/${ACCOUNT_ADDRESS}` },
    {
      name: 'get_account_transactions',
      path: `/account/transactions/${ACCOUNT_ADDRESS}?limit=25&offset=0`,
    },
    {
      name: 'get_account_delegations',
      path: `/account/delegations/${ACCOUNT_ADDRESS}`,
    },
  );
}

if (CONTRACT_ADDRESS) {
  baseRoutes.push(
    { name: 'get_contract_details', path: `/contract/details/${CONTRACT_ADDRESS}` },
    {
      name: 'get_contract_transactions',
      path: `/contract/transactions/${CONTRACT_ADDRESS}?limit=25&offset=0`,
    },
    { name: 'debug_contract', path: `/contract/debug/${CONTRACT_ADDRESS}` },
  );
}

const routes = baseRoutes;

const hit = (route) => {
  const res = http.get(`${BASE_URL}${route.path}`, {
    headers,
    tags: { name: route.name },
  });

  check(res, {
    [`${route.name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
};

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      exec: 'smokeTest',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },
    ramping: {
      executor: 'ramping-arrival-rate',
      exec: 'stressTest',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 20, duration: '2m' },
        { target: 40, duration: '2m' },
        { target: 60, duration: '2m' },
        { target: 10, duration: '1m' },
      ],
      tags: { test_type: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
    checks: ['rate>0.95'],
  },
};

export function smokeTest() {
  for (const route of routes) {
    hit(route);
    sleep(1);
  }
}

export function stressTest() {
  const route = routes[Math.floor(Math.random() * routes.length)];
  hit(route);
  sleep(0.1);
}
