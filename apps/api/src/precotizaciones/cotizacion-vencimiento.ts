import {
  Cotizacion,
  CotizacionEvento,
  EstadoCotizacion,
  TipoEventoCotizacion,
} from '@cotizador/database';
import type { DataSource } from 'typeorm';

/**
 * Evalúa vencimiento perezoso (spec 011): ENVIADA con vigenciaHasta < now
 * pasa a VENCIDA e inserta un solo evento VENCIDA. Idempotente.
 * @returns true si transicionó en esta llamada
 */
export async function aplicarVencimientoPerezoso(
  dataSource: DataSource,
  cotizacion: Cotizacion,
  now: Date = new Date(),
): Promise<boolean> {
  if (cotizacion.estado !== EstadoCotizacion.ENVIADA) return false;
  if (!cotizacion.vigenciaHasta) return false;
  if (cotizacion.vigenciaHasta.getTime() >= now.getTime()) return false;

  return dataSource.transaction(async (em) => {
    const actual = await em.findOne(Cotizacion, {
      where: { id: cotizacion.id, organizacionId: cotizacion.organizacionId },
    });
    if (!actual || actual.estado !== EstadoCotizacion.ENVIADA) return false;
    if (
      !actual.vigenciaHasta ||
      actual.vigenciaHasta.getTime() >= now.getTime()
    ) {
      return false;
    }

    actual.estado = EstadoCotizacion.VENCIDA;
    await em.save(actual);

    await em.save(
      em.create(CotizacionEvento, {
        organizacionId: actual.organizacionId,
        cotizacionId: actual.id,
        tipo: TipoEventoCotizacion.VENCIDA,
        descripcion: 'Cotización vencida por vigencia alcanzada',
        datos: {
          vigenciaHasta: actual.vigenciaHasta.toISOString(),
        },
        usuarioId: null,
      }),
    );

    cotizacion.estado = EstadoCotizacion.VENCIDA;
    return true;
  });
}

/**
 * Marca todas las ENVIADA vencidas de la organización. Usado al listar.
 * @returns cantidad marcada en esta llamada
 */
export async function marcarVencidasPendientesOrganizacion(
  dataSource: DataSource,
  organizacionId: string,
  now: Date = new Date(),
): Promise<number> {
  const pendientes = await dataSource
    .getRepository(Cotizacion)
    .createQueryBuilder('c')
    .where('c.organizacionId = :organizacionId', { organizacionId })
    .andWhere('c.estado = :estado', { estado: EstadoCotizacion.ENVIADA })
    .andWhere('c.vigenciaHasta IS NOT NULL')
    .andWhere('c.vigenciaHasta < :now', { now })
    .getMany();

  let marcadas = 0;
  for (const c of pendientes) {
    const ok = await aplicarVencimientoPerezoso(dataSource, c, now);
    if (ok) marcadas += 1;
  }
  return marcadas;
}
