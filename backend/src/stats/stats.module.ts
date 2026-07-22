import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { QueueModule } from '../queue/queue.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [QueueModule, CheckoutModule, InventoryModule],
  controllers: [StatsController],
})
export class StatsModule {}
