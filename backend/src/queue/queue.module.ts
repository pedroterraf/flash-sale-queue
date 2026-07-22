import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { JWT_SECRET } from '../config/constants';

@Module({
  imports: [JwtModule.register({ secret: JWT_SECRET })],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
