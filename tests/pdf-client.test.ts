import { describe, it, expect } from 'vitest';
import { assertFileSize } from '@/lib/pdf-client';

describe('assertFileSize', () => {
  it('aceita arquivo até 25MB', () => {
    expect(() => assertFileSize({ size: 25 * 1024 * 1024 })).not.toThrow();
  });

  it('rejeita arquivo acima de 25MB', () => {
    expect(() => assertFileSize({ size: 25 * 1024 * 1024 + 1 })).toThrow(/maior que 25MB/);
  });
});
