import { Injectable } from '@nestjs/common';
import {
  importacionArchivoInvalido,
  importacionArchivoVacio,
  importacionCabeceraInvalida,
  importacionFormatoNoSoportado,
  importacionHojaNoEncontrada,
} from '@cotizador/shared';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

export type ArchivoParseado = {
  cabeceras: string[];
  filas: Record<string, string>[];
  nombreHoja?: string;
};

export type HojaInspeccion = {
  nombre: string;
  cabeceras: string[];
};

export type InspeccionArchivo = {
  formato: 'csv' | 'xlsx';
  hojas: HojaInspeccion[];
  sugerida: string | null;
};

const HOJAS_GUIA = new Set([
  'instrucciones',
  'unidades',
  'listas',
  'marcas',
  'categorias',
]);

@Injectable()
export class ArchivoParserService {
  async parsear(
    buffer: Buffer,
    nombreArchivo: string,
    opciones?: { nombreHoja?: string | null },
  ): Promise<ArchivoParseado> {
    const ext = this.extension(nombreArchivo);
    if (ext === 'csv') {
      return this.parsearCsv(buffer);
    }
    if (ext === 'xlsx') {
      return this.parsearXlsx(buffer, opciones?.nombreHoja);
    }
    throw importacionFormatoNoSoportado();
  }

  async inspeccionar(
    buffer: Buffer,
    nombreArchivo: string,
  ): Promise<InspeccionArchivo> {
    const ext = this.extension(nombreArchivo);
    if (ext === 'csv') {
      const parseado = this.parsearCsv(buffer);
      return {
        formato: 'csv',
        hojas: [{ nombre: 'CSV', cabeceras: parseado.cabeceras }],
        sugerida: 'CSV',
      };
    }
    if (ext !== 'xlsx') {
      throw importacionFormatoNoSoportado();
    }

    const workbook = await this.cargarWorkbook(buffer);
    const hojas: HojaInspeccion[] = workbook.worksheets.map((s) => ({
      nombre: s.name,
      cabeceras: this.cabecerasDeHoja(s),
    }));
    if (hojas.length === 0) {
      throw importacionArchivoVacio();
    }
    const sugerida =
      this.resolverHojaDatos(workbook)?.name ??
      hojas.find((h) => !HOJAS_GUIA.has(h.nombre.trim().toLowerCase()))
        ?.nombre ??
      hojas[0]!.nombre;

    return { formato: 'xlsx', hojas, sugerida };
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

  private async parsearXlsx(
    buffer: Buffer,
    nombreHoja?: string | null,
  ): Promise<ArchivoParseado> {
    const workbook = await this.cargarWorkbook(buffer);
    const sheet = nombreHoja?.trim()
      ? workbook.getWorksheet(nombreHoja.trim())
      : this.resolverHojaDatos(workbook);

    if (!sheet) {
      throw importacionHojaNoEncontrada(nombreHoja?.trim() || undefined);
    }

    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as Array<
        string | number | boolean | Date | null | undefined
      >;
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

    return { cabeceras, filas, nombreHoja: sheet.name };
  }

  private async cargarWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch (err) {
      throw importacionArchivoInvalido({
        causa: err instanceof Error ? err.message : String(err),
      });
    }
    return workbook;
  }

  private cabecerasDeHoja(sheet: ExcelJS.Worksheet): string[] {
    const header = sheet.getRow(1);
    const values = header.values as Array<
      string | number | boolean | Date | null | undefined
    >;
    if (!values?.length) return [];
    const out: string[] = [];
    for (let i = 1; i < values.length; i++) {
      const t = this.celdaATexto(values[i]).trim();
      if (t) out.push(t);
    }
    return out;
  }

  /**
   * Prioriza la hoja «Plantilla». Nunca sugiere «Instrucciones» ni hojas de referencia.
   */
  private resolverHojaDatos(
    workbook: ExcelJS.Workbook,
  ): ExcelJS.Worksheet | undefined {
    const porNombre = workbook.getWorksheet('Plantilla');
    if (porNombre) return porNombre;

    const porCabecera = workbook.worksheets.find((s) => {
      if (HOJAS_GUIA.has(s.name.trim().toLowerCase())) return false;
      const header = s.getRow(1);
      const a = String(header.getCell(1).value ?? '')
        .trim()
        .toLowerCase();
      const b = String(header.getCell(2).value ?? '')
        .trim()
        .toLowerCase();
      return (
        a === 'sku' ||
        a === 'nombre' ||
        b === 'nombre' ||
        b === 'alias' ||
        b === 'listapreciocodigo'
      );
    });
    if (porCabecera) return porCabecera;

    return workbook.worksheets.find(
      (s) => !HOJAS_GUIA.has(s.name.trim().toLowerCase()),
    );
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
