import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: 'ZIGScan API',
      version: '1.2.0',
      // description: 'NestJS backend for ZigScan blockchain data',
      // endpoints: {
      //   health: '/api/v2/health',
      //   stats: '/api/v2/stats',
      //   query: '/api/v2/query',
      //   transactions: {
      //     stats: '/api/v2/transactions/stats',
      //     detail: '/api/v2/transaction/{tx_hash}',
      //   },
      //   contracts: {
      //     list: '/api/v2/contracts',
      //     debug: '/api/v2/contract/debug/{contract_address}',
      //     details: '/api/v2/contract/{contract_address}/details',
      //   },
      //   codes: {
      //     list: '/api/v2/codes',
      //     details: '/api/v2/code/{code_id}/details',
      //   },
      //   validators: {
      //     list: '/api/v2/validators',
      //     details: '/api/v2/validator/{validator_address}/details',
      //   },
      //   accounts: {
      //     details: '/api/v2/account/{address}/details',
      //   },
      //   admin: {
      //     users: '/api/v2/admin/users',
      //     system_stats: '/api/v2/admin/system-stats',
      //     execute_query: '/api/v2/admin/execute-query',
      //     audit_log: '/api/v2/admin/audit-log',
      //   },
      // },
    };
  }
}
