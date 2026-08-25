import { describe, expect, it } from 'vitest';
import { checkLevelFields } from '../src/lib/validate';

/** As três linhas canônicas, preenchidas. */
const canonico = (comprovado: string, prometido: string, distancia: string) =>
  [
    `NIVEL_COMPROVADO: ${comprovado}`,
    `NIVEL_PROMETIDO: ${prometido}`,
    `DISTANCIA: ${distancia}`,
  ].join('\n');

const campos = (out: string) => checkLevelFields(out).map((v) => v.field);

describe('checkLevelFields', () => {
  it('saída canônica e válida não produz violação', () => {
    expect(checkLevelFields(canonico('Sênior', 'Gestor', 'um degrau'))).toEqual([]);
  });

  it('caixa e espaço não são divergência', () => {
    expect(checkLevelFields(canonico('Sênior', 'Gestor', 'Um  Degrau'))).toEqual([]);
  });

  it('dois níveis no mesmo campo é violação, e o trecho sai verbatim', () => {
    // A falha real, 5 rodadas em 5: um valor único vira uma lista com barra.
    const [v] = checkLevelFields(canonico('Especialista / Coordenador Técnico', 'Gestor', 'nenhuma'));
    expect(v).toMatchObject({
      rule: 'D7 enum de nível',
      field: 'Nível comprovado',
      quote: 'Especialista / Coordenador Técnico',
    });
  });

  it('faixa no campo de distância é violação', () => {
    expect(campos(canonico('Júnior', 'Júnior', 'Nenhuma a Meio degrau'))).toEqual(['Distância']);
  });

  it('campo ausente é violação', () => {
    // A segunda rodada da Laura respondeu à Fase 3 e devolveu a análise sem o
    // bloco da Fase 1 inteiro.
    expect(campos('Análise sem o bloco de nível.')).toEqual([
      'Nível comprovado',
      'Nível prometido',
      'Distância',
    ]);
  });

  it('lê a prosa do prompt, não só o formato canônico', () => {
    const prosa = [
      '* **Nível comprovado hoje:** **Gestor**. O documento comprova liderança direta.',
      '* **Nível que o documento sugere ou promete:** **Diretor**.',
      '* **Distância entre os dois:** **Um degrau**. Os títulos sinalizam mais.',
    ].join('\n');
    expect(checkLevelFields(prosa)).toEqual([]);
  });

  it('a justificativa depois do valor não entra na comparação', () => {
    const out = '**Nível comprovado hoje:** **Gestor**. Gestor / Diretor seria exagero.';
    expect(checkLevelFields(out).map((v) => v.field)).not.toContain('Nível comprovado');
  });
});
