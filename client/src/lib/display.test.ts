import { describe, expect, it } from 'vitest';
import { formatCustomerLevel, toCleanFullDocumentText, toReadableSourcePreview } from './display';

describe('toReadableSourcePreview', () => {
  it('extracts product_doc text and drops index markup', () => {
    const preview = toReadableSourcePreview(
      '<product_category>Electronics</product_category><product_doc>블루투스 연결을 다시 설정하세요.</product_doc>'
    );

    expect(preview).toBe('블루투스 연결을 다시 설정하세요.');
    expect(preview).not.toContain('<product_category>');
  });

  it('skips indexed headings and the document title', () => {
    const preview = toReadableSourcePreview(
      '<product_category>Electronics</product_category><product_name>SoundWave X5 Pro</product_name>## Product Documentation\nThe headphones reconnect after a reset.',
      160,
      'SoundWave X5 Pro'
    );

    expect(preview).toBe('The headphones reconnect after a reset.');
    expect(preview).not.toContain('Electronics');
    expect(preview).not.toContain('##');
  });

  it('drops a leading index heading when it is the first text', () => {
    const preview = toReadableSourcePreview('### Introduction Welcome to the SoundStream Pro X5.');

    expect(preview).toBe('Welcome to the SoundStream Pro X5.');
    expect(preview).not.toContain('Introduction');
  });

  it('strips leftover tags and truncates long previews', () => {
    const preview = toReadableSourcePreview(`<p>${'안내 문구 '.repeat(40)}</p>`, 40);

    expect(preview.endsWith('…')).toBe(true);
    expect(preview).not.toContain('<p>');
    expect(preview.length).toBeLessThanOrEqual(41);
  });
});

describe('toCleanFullDocumentText', () => {
  it('extracts full body without XML tags and preserves content', () => {
    const full = toCleanFullDocumentText('<product_doc>전체 상품 설명 문장 1.\n전체 상품 설명 문장 2.</product_doc>');
    expect(full).toBe('전체 상품 설명 문장 1.\n전체 상품 설명 문장 2.');
    expect(full).not.toContain('<product_doc>');
  });
});

describe('formatCustomerLevel', () => {
  it('capitalizes a stored customer level', () => {
    expect(formatCustomerLevel('bronze')).toBe('Bronze');
  });
});
