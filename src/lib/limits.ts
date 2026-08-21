/**
 * Contagem de caracteres por campo.
 *
 * Aritmética trivial que não precisa de modelo nenhum. Existe porque headline
 * e "Sobre" do LinkedIn são truncados sem aviso, e uma sugestão de texto que
 * não cabe no campo é uma sugestão inútil.
 */

/**
 * Limites do LinkedIn conhecidos e verificados na plataforma.
 * Só entram aqui os que estão documentados no ROADMAP — número inventado
 * aqui vira recomendação errada lá na frente.
 */
export const LINKEDIN = {
  headline: 220,
  about: 2600,
} as const;

export type LinkedInField = keyof typeof LINKEDIN;

export type LengthCheck = {
  length: number;
  limit: number;
  /** Negativo quando estourou. */
  remaining: number;
  fits: boolean;
};

/**
 * Caracteres como o usuário os vê.
 *
 * `String.length` conta unidades UTF-16, então emoji e acento composto contam
 * dobrado — e currículo de LinkedIn é cheio de emoji.
 */
export const countChars = (text: string): number => [...text.normalize('NFC')].length;

export function checkLength(text: string, limit: number): LengthCheck {
  const length = countChars(text);
  return { length, limit, remaining: limit - length, fits: length <= limit };
}

export const checkField = (field: LinkedInField, text: string): LengthCheck =>
  checkLength(text, LINKEDIN[field]);
