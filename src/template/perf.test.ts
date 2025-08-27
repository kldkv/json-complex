import { describe, test, expect } from 'vitest';
import mustache from 'mustache';
import { Liquid } from 'liquidjs';
import { Eta } from 'eta';
import Sqrl from 'squirrelly';
import { createTemplate } from './lib';

function nowMs(): number {
  return performance.now();
}
function fmtMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

describe('Perf: сравнение с mustache', () => {
  test('baseline render (уникальный шаблон на каждой итерации)', async () => {
    const ITERATIONS = 5000;
    const results: Array<{ name: string; totalMs: number; nsPerOp: number }> =
      [];

    function record(name: string, totalMs: number) {
      results.push({ name, totalMs, nsPerOp: (totalMs / ITERATIONS) * 1e6 });
    }
    function printSummary() {
      const header = `\nPerf summary (${ITERATIONS} iterations)\n`;
      const rows = results
        .sort((a, b) => a.nsPerOp - b.nsPerOp)
        .map((r) => {
          const msStr = fmtMs(r.totalMs).padStart(10, ' ');
          const nsOp = `${r.nsPerOp.toFixed(0)} ns/op`.padStart(14, ' ');
          return `- ${r.name.padEnd(10, ' ')}: ${msStr}  ${nsOp}`;
        })
        .join('\n');
      // eslint-disable-next-line no-console
      console.log(header + rows + '\n');
    }

    const baseTemplate =
      'Hello, {{user.name}}! You have {{stats.unread}} new messages. ' +
      '{{title}} @ {{company}} in {{address.city}}, {{address.street}}. ' +
      'Repeat: {{user.name}} {{user.name}} {{stats.unread}}';

    const data = {
      user: { name: 'Alex' },
      stats: { unread: 42 },
      title: 'Engineer',
      company: 'Acme',
      address: { city: 'SPB', street: 'Main' },
    } as const;

    const custom = createTemplate({});

    // sanity check (один прогон)
    const mustacheOnce = mustache.render(baseTemplate, data as any);
    const customOnce = custom(baseTemplate, data as any);
    expect(customOnce).toBe(mustacheOnce);

    // mustache (уникальный шаблон на каждую итерацию, кэш компиляции не помогает)
    const t1 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      const tpl = `${baseTemplate} {{! ${i} }}`;
      mustache.render(tpl, data as any);
    }
    const mustacheTime = nowMs() - t1;
    record('mustache', mustacheTime);

    // наша реализация (тоже с уникальным шаблоном)
    const t2 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      const tpl = `${baseTemplate} {{! ${i} }}`;
      custom(tpl, data as any);
    }
    const customTime = nowMs() - t2;
    record('custom', customTime);

    // LiquidJS
    const liquid = new Liquid({ cache: false });
    const liquidBase =
      'Hello, {{ user.name }}! You have {{ stats.unread }} new messages. ' +
      '{{ title }} @ {{ company }} in {{ address.city }}, {{ address.street }}. ' +
      'Repeat: {{ user.name }} {{ user.name }} {{ stats.unread }}';
    const t3 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      const tpl = `${liquidBase} {% comment %} ${i} {% endcomment %}`;
      // eslint-disable-next-line no-await-in-loop
      await liquid.parseAndRender(tpl, data as any);
    }
    const liquidTime = nowMs() - t3;
    record('LiquidJS', liquidTime);

    // Eta
    const etaBase =
      'Hello, <%= it.user.name %>! You have <%= it.stats.unread %> new messages. ' +
      '<%= it.title %> @ <%= it.company %> in <%= it.address.city %>, <%= it.address.street %>. ' +
      'Repeat: <%= it.user.name %> <%= it.user.name %> <%= it.stats.unread %>';
    const etaEngine = new Eta();
    const t4 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      const tpl = `${etaBase} ${i}`; // уникализируем текст
      etaEngine.renderString(tpl, data as any);
    }
    const etaTime = nowMs() - t4;
    record('Eta', etaTime);

    // Squirrelly
    const sqrlBase =
      'Hello, {{it.user.name}}! You have {{it.stats.unread}} new messages. ' +
      '{{it.title}} @ {{it.company}} in {{it.address.city}}, {{it.address.street}}. ' +
      'Repeat: {{it.user.name}} {{it.user.name}} {{it.stats.unread}}';
    const t5 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      const tpl = `${sqrlBase} ${i}`; // уникализируем текст
      Sqrl.render(tpl, data as any);
    }
    const sqrlTime = nowMs() - t5;
    record('Squirrelly', sqrlTime);

    // Кэшируемые сценарии (одна и та же строка на всех итерациях)
    // mustache (один и тот же шаблон, должен использовать внутренний кэш парсинга)
    const t6 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      mustache.render(baseTemplate, data as any);
    }
    const mustacheCachedTime = nowMs() - t6;
    record('mustache (cached)', mustacheCachedTime);

    // наша реализация (один и тот же шаблон)
    const t7 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      custom(baseTemplate, data as any);
    }
    const customCachedTime = nowMs() - t7;
    record('custom (cached)', customCachedTime);

    // LiquidJS с включённым кэшем парсинга
    const liquidCached = new Liquid({ cache: true });
    const t8 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      // eslint-disable-next-line no-await-in-loop
      await liquidCached.parseAndRender(liquidBase, data as any);
    }
    const liquidCachedTime = nowMs() - t8;
    record('LiquidJS (cached)', liquidCachedTime);

    // Eta: компилируем один раз и исполняем много раз
    const etaCompiled = etaEngine.compile(etaBase).bind(etaEngine);
    const t9 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      etaCompiled(data as any);
    }
    const etaCachedTime = nowMs() - t9;
    record('Eta (cached)', etaCachedTime);

    // Squirrelly: компилируем один раз и исполняем много раз
    const sqrlCompiled = Sqrl.compile(sqrlBase);
    const t10 = nowMs();
    for (let i = 0; i < ITERATIONS; i++) {
      sqrlCompiled(data as any, Sqrl.defaultConfig);
    }
    const sqrlCachedTime = nowMs() - t10;
    record('Squirrelly (cached)', sqrlCachedTime);

    printSummary();
  });
});
