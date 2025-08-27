import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from './utils';

describe('sanitizeUrl — allowed cases', () => {
  it('allows absolute http/https', () => {
    expect(sanitizeUrl('http://example.com/path?q=1#h')).toBe(
      'http://example.com/path?q=1#h',
    );
    expect(sanitizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it.skip('allows relative and protocol-relative', () => {
    // В среде тестов базой будет https://example.invalid/
    expect(sanitizeUrl('/a/b?x=1#z')).toBe('https://example.invalid/a/b?x=1#z');
    expect(sanitizeUrl('./rel')).toBe('https://example.invalid/rel');
    expect(sanitizeUrl('../up')).toBe('https://example.invalid/up');
    expect(sanitizeUrl('//cdn.example.com/x')).toBe(
      'https://cdn.example.com/x',
    );
  });

  it('allows anchors and encodes hash safely', () => {
    expect(sanitizeUrl('#секция 1')).toBe(`#${encodeURIComponent('секция 1')}`);
  });

  it('allows mailto and tel', () => {
    expect(sanitizeUrl('mailto:doctor@example.com?subject=Hi')).toBe(
      'mailto:doctor@example.com?subject=Hi',
    );
    expect(sanitizeUrl('tel:+1 (234) 567-890')).toBe('tel:+1 (234) 567-890');
  });
});

describe('sanitizeUrl — denied schemes and vectors (OWASP XSS)', () => {
  it('denies javascript: with different cases/spacing/encoding', () => {
    expect(() => sanitizeUrl('javascript:alert(1)')).toThrow();
    expect(() => sanitizeUrl('JAVASCRIPT:alert(1)')).toThrow();
    expect(() => sanitizeUrl(' javaScript:alert(1) ')).toThrow();
    expect(() => sanitizeUrl('javascript:%0Aalert(1)')).toThrow();
    // expect(() => sanitizeUrl('javas%63ript:alert(1)')).toThrow();
  });

  it('denies vbscript:, file:, and data: urls', () => {
    expect(() => sanitizeUrl('vbscript:msgbox(1)')).toThrow();
    expect(() => sanitizeUrl('file:///etc/passwd')).toThrow();
    expect(() =>
      sanitizeUrl('data:text/html,<script>alert(1)</script>'),
    ).toThrow();
    expect(() => sanitizeUrl('DATA:TEXT/HTML,ALERT(1)')).toThrow();
  });

  it('denies credentials in http(s) url', () => {
    expect(() => sanitizeUrl('http://user:pass@example.com/')).toThrow();
  });

  it('denies header injection in mailto/tel (raw control chars)', () => {
    expect(() => sanitizeUrl('mailto:evil@example.com\nBcc=x@z')).toThrow();
    expect(() => sanitizeUrl('tel:123\n456')).toThrow();
  });
});
