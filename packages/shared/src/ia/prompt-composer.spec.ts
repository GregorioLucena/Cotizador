import { describe, expect, it } from 'vitest';
import { POLITICA_EXTRACCION_DEFAULT } from '../schemas/prompt-ia.schemas';
import { componerPromptExtraccion } from './prompt-composer';

describe('componerPromptExtraccion', () => {
  it('incluye contrato, blacklist y unidades en system', () => {
    const compuesto = componerPromptExtraccion({
      politica: POLITICA_EXTRACCION_DEFAULT,
      codigoVersion: 'extraccion-lineas.v1',
      entrada: {
        textoNormalizado: '2 tubos de 1/2',
        unidadesValidas: ['UND', 'M'],
        limiteLineas: 40,
      },
    });

    expect(compuesto.versionPrompt).toBe('extraccion-lineas.v1');
    expect(compuesto.mensajes).toHaveLength(2);
    const system = compuesto.mensajes[0].content;
    expect(system).toContain('Prohibido incluir: precios');
    expect(system).toContain('necesito');
    expect(system).toContain('UND');
    expect(compuesto.mensajes[1].content).toContain('2 tubos de 1/2');
  });
});
