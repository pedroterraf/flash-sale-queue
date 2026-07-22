import { Module, OnModuleInit } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { CheckoutModule } from './checkout/checkout.module';
import { InventoryModule } from './inventory/inventory.module';
import { StatsModule } from './stats/stats.module';
import { InventoryService } from './inventory/inventory.service';
import { DEFAULT_SALE_ID, TOTAL_STOCK } from './config/constants';

@Module({
  imports: [RedisModule, QueueModule, CheckoutModule, InventoryModule, StatsModule],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly inventory: InventoryService) {}

  async onModuleInit() {
    await this.inventory.ensureInitialized(DEFAULT_SALE_ID, TOTAL_STOCK);
  }
}
