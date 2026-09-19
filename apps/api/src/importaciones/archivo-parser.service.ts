import { Injectable } from '@nestjs/common';
import {
  importacionArchivoInvalido,
  importacionArchivoVacio,
  importacionCabeceraInvalida,
  importacionFormatoNoSoportado,
} from '@cotizador/shared';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

export type ArchivoParseado = {
  cabeceras: string[];
  filas: Record<string, string>[];
};

@Injectable()
export class ArchivoParserService {
  async parsear(buffer: Buffer, nombreArchivo: string): Promise<ArchivoParseado> {
    const ext = this.extension(nombreArchivo);
    if (ext === 'csv') {
      return this.parsearCsv(buffer);
    }
    if (ext === 'xlsx') {
      return this.parsearXlsx(buffer);
    }
    throw importacionFormatoNoSoportado();
  }

  extension(nombreArchivo: string): string {
    const i = nombreArchivo.lastIndexOf('.');
    if (i < 0) return '';
    return nombreArchivo.slice(i + 1).toLowerCase();
  }

  private parsearCsv(buffer: Buffer): ArchivoParseado {
    let records: Record<string, string>[];
    try {
      records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
        encoding: 'utf-8',
      }) as Record<string, string>[];
    } catch (err) {
      throw importacionArchivoInvalido({
        causa: err instanceof Error ? err.message : String(err),
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw importacionArchivoVacio();
    }

    const cabeceras = Object.keys(records[0] ?? {}).map((c) => String(c).trim());
    if (cabeceras.length === 0 || cabeceras.every((c) => !c)) {
      throw importacionCabeceraInvalida();
    }

    const filas = records.map((r) => {
      const out: Record<string, string> = {};
      for (const c of cabeceras) {
        const v = r[c];
        out[c] = v == null ? '' : String(v).trim();
      }
      return out;
    });

    return { cabeceras, filas };
  }

  private async parsearXlsx(buffer: Buffer): Promise<ArchivoParseado> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs acepta Buffer en runtime; tipado estricto pide ArrayBuffer
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch (err) {
      throw importacionArchivoInvalido({
        causa: err instanceof Error ? err.message : String(err),
      });
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw importacionArchivoVacio();
    }

    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as Array<string | number | boolean | Date | null | undefined>;
      // exceljs indexa desde 1
      const celdas: string[] = [];
      for (let i = 1; i < values.length; i++) {
        celdas.push(this.celdaATexto(values[i]));
      }
      rows.push(celdas);
    });

    if (rows.length === 0) {
      throw importacionArchivoVacio();
    }

    const cabeceras = rows[0].map((c) => c.trim());
    if (cabeceras.length === 0 || cabeceras.every((c) => !c)) {
      throw importacionCabeceraInvalida();
    }

    const filasDatos = rows.slice(1);
    if (filasDatos.length === 0) {
      throw importacionArchivoVacio();
    }

    const filas = filasDatos.map((celdas) => {
      const out: Record<string, string> = {};
      for (let i = 0; i < cabeceras.length; i++) {
        const cab = cabeceras[i];
        if (!cab) continue;
        out[cab] = (celdas[i] ?? '').trim();
      }
      return out;
    });

    return { cabeceras, filas };
  }

  private celdaATexto(
    valor: string | number | boolean | Date | null | undefined,
  ): string {
    if (valor == null) return '';
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === 'boolean') return valor ? 'true' : 'false';
    return String(valor);
  }
}
