import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { AdmissionGuard } from './admission.guard';
import { DistributedLockService } from './distributed-lock.service';
import { InventoryModule } from '../inventory/inventory.module';
import { JWT_SECRET } from '../config/constants';

@Module({
  imports: [JwtModule.register({ secret: JWT_SECRET }), InventoryModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, AdmissionGuard, DistributedLockService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
