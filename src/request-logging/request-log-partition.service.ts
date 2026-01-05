import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ApiRequestLogPartitionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiRequestLogPartitionService.name);
  private readonly retentionMonths = 6;
  private maintenanceTimer?: NodeJS.Timeout;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.safelySyncPartitions('startup');
    // Re-run daily to ensure partitions roll forward even if the app runs continuously.
    this.maintenanceTimer = setInterval(
      () => {
        void this.safelySyncPartitions('interval');
      },
      24 * 60 * 60 * 1000,
    );
  }

  onModuleDestroy(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }
  }

  private async safelySyncPartitions(trigger: string): Promise<void> {
    try {
      await this.syncPartitions();
    } catch (error) {
      this.logger.error(
        `Failed to sync API request log partitions (${trigger}): ${error?.message ?? error}`,
      );
    }
  }

  private async syncPartitions(): Promise<void> {
    const now = new Date();
    const earliestMonthStart = this.getMonthStart(now, -1 * (this.retentionMonths - 1));

    // Ensure partitions exist for each month in the retention window.
    for (let offset = -(this.retentionMonths - 1); offset <= 0; offset++) {
      const monthStart = this.getMonthStart(now, offset);
      const nextMonthStart = this.getMonthStart(now, offset + 1);
      await this.ensurePartition(monthStart, nextMonthStart);
    }

    await this.dropExpiredPartitions(earliestMonthStart);
  }

  private getMonthStart(base: Date, monthOffset: number): Date {
    return new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, 1, 0, 0, 0, 0),
    );
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private partitionTableName(date: Date): string {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    return `api_request_logs_${year}_${month}`;
  }

  private async ensurePartition(monthStart: Date, nextMonthStart: Date): Promise<void> {
    const tableName = this.partitionTableName(monthStart);
    const from = this.formatDate(monthStart);
    const to = this.formatDate(nextMonthStart);

    const conflictingRowsCount = await this.countDefaultPartitionRows(from, to);

    let movedRows = false;
    if (conflictingRowsCount > 0) {
      await this.moveRowsToTempPartition(from, to, tableName);
      movedRows = true;
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS "${tableName}"
      PARTITION OF api_request_logs
      FOR VALUES FROM ('${from}') TO ('${to}');
    `;

    try {
      await this.dataSource.query(sql);
    } finally {
      if (movedRows) {
        await this.restoreTempPartitionRows();
      }
    }
  }

  private async countDefaultPartitionRows(from: string, to: string): Promise<number> {
    const result: Array<{ count: string }> = await this.dataSource.query(
      `
        SELECT COUNT(*)::text AS count
        FROM api_request_logs_default
        WHERE created_at >= $1 AND created_at < $2
      `,
      [from, to],
    );

    const count = Number(result[0]?.count ?? 0);
    return Number.isFinite(count) ? count : 0;
  }

  private tempPartitionTableName = 'temp_api_request_logs_partition';

  private async moveRowsToTempPartition(
    from: string,
    to: string,
    partitionName: string,
  ): Promise<void> {
    await this.dataSource.query(`DROP TABLE IF EXISTS "${this.tempPartitionTableName}"`);

    await this.dataSource.query(
      `
        CREATE TABLE "${this.tempPartitionTableName}" AS
        SELECT * FROM api_request_logs_default
        WHERE created_at >= $1 AND created_at < $2
      `,
      [from, to],
    );

    await this.dataSource.query(
      `
        DELETE FROM api_request_logs_default
        WHERE created_at >= $1 AND created_at < $2
      `,
      [from, to],
    );

    this.logger.log(`Moved rows for ${partitionName} out of api_request_logs_default`);
  }

  private async restoreTempPartitionRows(): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO api_request_logs
      SELECT * FROM "${this.tempPartitionTableName}"
    `);
    await this.dataSource.query(`DROP TABLE IF EXISTS "${this.tempPartitionTableName}"`);
  }

  private async dropExpiredPartitions(retentionStart: Date): Promise<void> {
    const retentionDate = this.formatDate(retentionStart);
    const partitions: Array<{ partition_name: string }> = await this.dataSource.query(`
      SELECT child.relname AS partition_name
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child ON pg_inherits.inhrelid = child.oid
      WHERE parent.relname = 'api_request_logs'
        AND child.relname <> 'api_request_logs_default';
    `);

    for (const partition of partitions) {
      const partitionDate = this.extractPartitionDate(partition.partition_name);
      if (!partitionDate) {
        continue;
      }

      if (partitionDate < retentionDate) {
        await this.dataSource.query(`DROP TABLE IF EXISTS "${partition.partition_name}"`);
        this.logger.log(`Dropped expired API request log partition ${partition.partition_name}`);
      }
    }
  }

  private extractPartitionDate(partitionName: string): string | null {
    const match = partitionName.match(/^api_request_logs_(\d{4})_(\d{2})$/);
    if (!match) {
      return null;
    }
    return `${match[1]}-${match[2]}-01`;
  }
}
