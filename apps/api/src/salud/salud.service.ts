import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SaludService {
  constructor(private readonly dataSource: DataSource) {}

  async verificar() {
    let baseDatos: 'ok' | 'error' = 'ok';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      baseDatos = 'error';
    }

    return {
      estado: baseDatos === 'ok' ? 'ok' : 'degradado',
      baseDatos,
      marcaTiempo: new Date().toISOString(),
    };
  }
}
