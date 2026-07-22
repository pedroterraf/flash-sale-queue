import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { QueueService } from '../queue/queue.service';
import { CheckoutService } from '../checkout/checkout.service';
import { InventoryService } from '../inventory/inventory.service';
import { RedisService } from '../redis/redis.service';
import { DEFAULT_SALE_ID, TOTAL_STOCK, ADMISSION_RATE_PER_SECOND } from '../config/constants';
import { tokenBucketKey } from '../config/keys';

class ChaosDto {
  @IsBoolean()
  enabled!: boolean;
}

@Controller()
export class StatsController {
  constructor(
    private readonly queueService: QueueService,
    private readonly checkoutService: CheckoutService,
    private readonly inventory: InventoryService,
    private readonly redis: RedisService,
  ) {}

  @Get('stats')
  async stats(@Query('saleId') saleId = DEFAULT_SALE_ID) {
    const [queueDepth, admittedCount, stock, soldCount, chaos, redisHealthy] = await Promise.all([
      this.queueService.getQueueDepth(saleId),
      this.queueService.getAdmittedCount(saleId),
      this.inventory.getStock(saleId),
      this.inventory.getSoldCount(saleId),
      this.inventory.isChaosEnabled(),
      this.redis.isHealthy(),
    ]);

    return {
      saleId,
      queueDepth,
      admittedCount,
      stock,
      soldCount,
      totalStock: TOTAL_STOCK,
      admissionRatePerSecond: ADMISSION_RATE_PER_SECOND,
      chaosEnabled: chaos,
      redisHealthy,
      breaker: this.checkoutService.getBreakerStats(),
    };
  }

  /**
   * Last `seconds` per-second admission counts, straight from the same
   * token-bucket keys the Lua admission script (`admitNext`) increments —
   * this is real state from the rate limiter itself, not a separate metric
   * pipeline, so the chart can never drift from what actually happened.
   */
  @Get('stats/timeseries')
  async timeseries(
    @Query('saleId') saleId = DEFAULT_SALE_ID,
    @Query('seconds') secondsRaw = '30',
  ) {
    const seconds = Math.min(Math.max(Number(secondsRaw) || 30, 1), 120);
    const now = Math.floor(Date.now() / 1000);
    const secondsRange = Array.from({ length: seconds }, (_, i) => now - (seconds - 1 - i));
    const keys = secondsRange.map((s) => tokenBucketKey(saleId, s));
    const values = keys.length > 0 ? await this.redis.client.mget(...keys) : [];

    return {
      saleId,
      ratePerSecond: ADMISSION_RATE_PER_SECOND,
      buckets: secondsRange.map((second, i) => ({
        second,
        count: Number(values[i] ?? 0),
      })),
    };
  }

  @Post('admin/chaos')
  async setChaos(@Body() dto: ChaosDto) {
    await this.inventory.setChaos(dto.enabled);
    return { chaosEnabled: dto.enabled };
  }

  @Post('admin/reset')
  async reset(@Query('saleId') saleId = DEFAULT_SALE_ID) {
    const fixedKeys = [
      `queue:${saleId}`,
      `stock:${saleId}`,
      `sold:${saleId}`,
      `admitted:count:${saleId}`,
      'chaos:enabled',
    ];
    const ticketKeys = await this.redis.client.keys(`ticket:${saleId}:*`);
    const tokenBucketKeys = await this.redis.client.keys(`admission:tokens:${saleId}:*`);
    await this.redis.client.del(...fixedKeys, ...ticketKeys, ...tokenBucketKeys);
    await this.inventory.ensureInitialized(saleId, TOTAL_STOCK);
    return { reset: true, saleId };
  }
}
