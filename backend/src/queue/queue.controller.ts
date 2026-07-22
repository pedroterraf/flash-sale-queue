import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JoinQueueDto } from './dto/join-queue.dto';
import { DEFAULT_SALE_ID } from '../config/constants';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('join')
  join(@Body() dto: JoinQueueDto) {
    return this.queueService.join(dto.saleId ?? DEFAULT_SALE_ID);
  }

  @Get('status/:queueId')
  status(@Param('queueId') queueId: string, @Query('saleId') saleId?: string) {
    return this.queueService.status(saleId ?? DEFAULT_SALE_ID, queueId);
  }
}
