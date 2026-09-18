import { Controller, Get } from '@nestjs/common';
import { Publico } from '../common/decorators/publico.decorator';
import { SaludService } from './salud.service';

@Controller('salud')
export class SaludController {
  constructor(private readonly saludService: SaludService) {}

  @Publico()
  @Get()
  async verificar() {
    const data = await this.saludService.verificar();
    return { data };
  }
}
