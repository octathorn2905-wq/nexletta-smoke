import fs from 'fs';
import path from 'path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

type Outcome = 'passed' | 'failed' | 'blocked';

interface Recorded {
  id: string;
  title: string;
  role: string;
  outcome: Outcome;
  expected: string;
  actual: string;
  repro: string;
  failureClass: string;
  error: string;
  screenshot?: string;
  trace?: string;
  durationMs: number;
}

const ROLES = [
  'Admin',
  'Scheduler',
  'Biller',
  'Reviewer',
  'Organization',
  'Veteran',
  'Representative',
  'Provider',
];

function annotation(result: TestResult, test: TestCase, type: string): string {
  const fromResult = result.annotations.find((item) => item.type === type)?.description;
  if (fromResult) return fromResult;
  return test.annotations.find((item) => item.type === type)?.description || '';
}

function classify(result: TestResult): { outcome: Outcome; failureClass: string } {
  if (result.status === 'passed') return { outcome: 'passed', failureClass: '' };
  const message = `${result.error?.message || ''}\n${result.error?.stack || ''}`;
  if (/\[test-data\]/i.test(message) || /\[automation\]/i.test(message)) {
    const failureClass = /\[test-data\]/i.test(message) ? 'test-data' : 'automation';
    return { outcome: 'blocked', failureClass };
  }
  if (result.status === 'skipped' || result.status === 'interrupted') {
    return { outcome: 'blocked', failureClass: 'automation' };
  }
  if (result.status === 'timedOut') return { outcome: 'blocked', failureClass: 'automation' };
  return { outcome: 'failed', failureClass: 'application' };
}

function roleOf(test: TestCase, result: TestResult): string {
  return annotation(result, test, 'role') || test.parent?.title || 'Unscoped';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rel(fromDir: string, file?: string): string | undefined {
  if (!file) return undefined;
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) return undefined;
  return path.relative(fromDir, absolute).split(path.sep).join('/');
}

class StabilityReporter implements Reporter {
  private readonly records = new Map<string, Recorded>();

  onTestEnd(test: TestCase, result: TestResult): void {
    if (test.results.length === 0) return;
    const { outcome, failureClass } = classify(result);
    const screenshot = result.attachments.find((item) => item.name === 'screenshot' && item.path)?.path;
    const trace = result.attachments.find((item) => item.name === 'trace' && item.path)?.path;
    const steps = result.steps
      .filter((step) => step.category === 'test.step')
      .map((step, index) => `${index + 1}. ${step.title}`)
      .join('\n');
    const error = (result.error?.message || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
    this.records.set(test.id, {
      id: test.id,
      title: test.title,
      role: roleOf(test, result),
      outcome,
      expected: annotation(result, test, 'expected') || 'Required smoke behavior for this role.',
      actual: annotation(result, test, 'actual') || (outcome === 'passed' ? 'Matched the expected UI behavior.' : error || 'No actual result was captured.'),
      repro: annotation(result, test, 'repro') || steps || test.titlePath().join(' > '),
      failureClass,
      error,
      screenshot,
      trace,
      durationMs: result.duration,
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const reportDir = path.resolve(process.cwd(), 'reports');
    fs.mkdirSync(reportDir, { recursive: true });
    const items = [...this.records.values()];
    const passed = items.filter((item) => item.outcome === 'passed').length;
    const failed = items.filter((item) => item.outcome === 'failed').length;
    const blocked = items.filter((item) => item.outcome === 'blocked').length;
    const missingRoles = ROLES.filter((role) => !items.some((item) => item.role === role));
    const stable = failed === 0 && blocked === 0 && items.length > 0 && missingRoles.length === 0;
    const status = stable ? 'STABLE' : 'NOT STABLE';
    const generatedAt = new Date().toISOString();

    const roleRows = ROLES.map((role) => {
      const tests = items.filter((item) => item.role === role);
      return {
        role,
        total: tests.length,
        passed: tests.filter((item) => item.outcome === 'passed').length,
        failed: tests.filter((item) => item.outcome === 'failed').length,
        blocked: tests.filter((item) => item.outcome === 'blocked').length,
        status: tests.length === 0 ? 'NOT RUN' : tests.every((item) => item.outcome === 'passed') ? 'PASS' : 'FAIL',
      };
    });

    const markdown = this.markdown({ status, generatedAt, passed, failed, blocked, total: items.length, roleRows, items, playwrightStatus: result.status, reportDir });
    const html = this.html({ status, generatedAt, passed, failed, blocked, total: items.length, roleRows, items, reportDir });
    fs.writeFileSync(path.join(reportDir, 'smoke-report.md'), markdown, 'utf8');
    fs.writeFileSync(path.join(reportDir, 'smoke-report.html'), html, 'utf8');
    fs.writeFileSync(
      path.join(reportDir, 'smoke-summary.json'),
      JSON.stringify({ status, generatedAt, total: items.length, passed, failed, blocked, playwrightStatus: result.status, roles: roleRows }, null, 2),
      'utf8',
    );

    const line = `\nNexletta smoke: ${status}  passed=${passed} failed=${failed} blocked=${blocked} total=${items.length}\nReport: ${path.join(reportDir, 'smoke-report.html')}\n`;
    console.log(line);
  }

  private markdown(input: {
    status: string;
    generatedAt: string;
    passed: number;
    failed: number;
    blocked: number;
    total: number;
    roleRows: { role: string; total: number; passed: number; failed: number; blocked: number; status: string }[];
    items: Recorded[];
    playwrightStatus: string;
    reportDir: string;
  }): string {
    const lines = [
      '# Nexletta post-deployment smoke report',
      '',
      `Overall Status: **${input.status}**`,
      '',
      `Generated: ${input.generatedAt}`,
      '',
      'STABLE means every required role check passed. A failed application check or a blocked automation/test-data check keeps the release NOT STABLE.',
      '',
      '## Summary',
      '',
      `| Total tests | Passed | Failed | Blocked |`,
      `| --- | --- | --- | --- |`,
      `| ${input.total} | ${input.passed} | ${input.failed} | ${input.blocked} |`,
      '',
      '## Role-wise results',
      '',
      '| Role | Total | Passed | Failed | Blocked | Result |',
      '| --- | --- | --- | --- | --- | --- |',
      ...input.roleRows.map((row) => `| ${row.role} | ${row.total} | ${row.passed} | ${row.failed} | ${row.blocked} | ${row.status} |`),
      '',
    ];

    const problems = input.items.filter((item) => item.outcome !== 'passed');
    if (problems.length === 0) {
      lines.push('## Failed and blocked tests', '', 'None.', '');
    } else {
      lines.push('## Failed and blocked tests', '');
      for (const item of problems) {
        const screenshot = rel(input.reportDir, item.screenshot);
        const trace = rel(input.reportDir, item.trace);
        lines.push(
          `### ${item.outcome.toUpperCase()}: ${item.role} — ${item.title}`,
          '',
          `- Classification: ${item.failureClass || 'application'}`,
          `- Path: ${item.role} / ${item.title}`,
          `- Expected: ${item.expected}`,
          `- Actual: ${item.actual}`,
          `- Reproduction steps:`,
          '',
          item.repro,
          '',
          `- Screenshot: ${screenshot || 'not captured'}`,
          `- Trace: ${trace || 'not captured'}`,
          '',
        );
        if (item.error) {
          lines.push('```', item.error.slice(0, 2000), '```', '');
        }
      }
    }
    lines.push(`Playwright process status: ${input.playwrightStatus}`, '');
    return lines.join('\n');
  }

  private html(input: {
    status: string;
    generatedAt: string;
    passed: number;
    failed: number;
    blocked: number;
    total: number;
    roleRows: { role: string; total: number; passed: number; failed: number; blocked: number; status: string }[];
    items: Recorded[];
    reportDir: string;
  }): string {
    const banner = input.status === 'STABLE' ? '#1f7a4d' : '#9b2335';
    const roleTable = input.roleRows
      .map(
        (row) => `<tr>
          <td>${escapeHtml(row.role)}</td>
          <td>${row.total}</td><td>${row.passed}</td><td>${row.failed}</td><td>${row.blocked}</td>
          <td class="${row.status === 'PASS' ? 'ok' : 'bad'}">${escapeHtml(row.status)}</td>
        </tr>`,
      )
      .join('');
    const problems = input.items.filter((item) => item.outcome !== 'passed');
    const problemHtml = problems.length
      ? problems
          .map((item) => {
            const screenshot = rel(input.reportDir, item.screenshot);
            const trace = rel(input.reportDir, item.trace);
            return `<article class="card ${item.outcome}">
              <h3>${escapeHtml(item.outcome.toUpperCase())}: ${escapeHtml(item.role)} — ${escapeHtml(item.title)}</h3>
              <p class="class">Classification: <strong>${escapeHtml(item.failureClass || 'application')}</strong></p>
              <dl>
                <dt>Path</dt><dd>${escapeHtml(item.role)} / ${escapeHtml(item.title)}</dd>
                <dt>Expected</dt><dd>${escapeHtml(item.expected)}</dd>
                <dt>Actual</dt><dd>${escapeHtml(item.actual)}</dd>
                <dt>Reproduction steps</dt><dd><pre>${escapeHtml(item.repro)}</pre></dd>
                <dt>Screenshot</dt><dd>${screenshot ? `<a href="${escapeHtml(screenshot)}">${escapeHtml(screenshot)}</a>` : 'not captured'}</dd>
                <dt>Trace</dt><dd>${trace ? `<a href="${escapeHtml(trace)}">${escapeHtml(trace)}</a>` : 'not captured'}</dd>
              </dl>
              ${item.error ? `<pre class="err">${escapeHtml(item.error.slice(0, 2500))}</pre>` : ''}
            </article>`;
          })
          .join('')
      : '<p class="empty">No failed or blocked tests.</p>';

    const passedList = input.items
      .filter((item) => item.outcome === 'passed')
      .map((item) => `<li><strong>${escapeHtml(item.role)}</strong> — ${escapeHtml(item.title)}<br><span>${escapeHtml(item.actual)}</span></li>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Nexletta smoke report — ${escapeHtml(input.status)}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: "Segoe UI", Inter, sans-serif; background: #f4f6f8; color: #1b2430; }
    header { background: #1b2a4a; color: white; padding: 28px 40px 32px; }
    header p { margin: 6px 0 0; color: #d5dbe6; }
    .banner { display: inline-block; margin-top: 16px; background: ${banner}; color: white; font-weight: 700; letter-spacing: 0.08em; padding: 10px 16px; border-radius: 6px; }
    main { padding: 28px 40px 64px; max-width: 1100px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 8px 0 28px; }
    .stat { background: white; border-radius: 10px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
    .stat b { display: block; font-size: 28px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e6ebf2; }
    th { background: #eef2f7; font-size: 13px; }
    .ok { color: #1f7a4d; font-weight: 700; }
    .bad { color: #9b2335; font-weight: 700; }
    h2 { margin: 32px 0 12px; }
    .card { background: white; border-left: 6px solid #9b2335; border-radius: 10px; padding: 16px 18px; margin: 0 0 14px; }
    .card.blocked { border-left-color: #9a6b12; }
    .card h3 { margin: 0 0 8px; }
    dl { display: grid; grid-template-columns: 160px 1fr; gap: 6px 12px; margin: 0; }
    dt { color: #5c6b7a; }
    dd { margin: 0; }
    pre { white-space: pre-wrap; font-family: Consolas, monospace; font-size: 13px; background: #f7f8fa; padding: 10px; border-radius: 6px; }
    .err { background: #fff6f6; }
    ul.passed { padding-left: 18px; }
    ul.passed li { margin: 0 0 10px; }
    ul.passed span { color: #5c6b7a; }
    .empty { background: white; padding: 16px; border-radius: 10px; }
    a { color: #1b2a4a; }
  </style>
</head>
<body>
  <header>
    <h1>Nexletta post-deployment smoke report</h1>
    <p>Generated ${escapeHtml(input.generatedAt)}. Run this before bug tickets. Application defects are Failed. Missing credentials, selector drift, and missing records are Blocked.</p>
    <div class="banner">Overall Status: ${escapeHtml(input.status)}</div>
  </header>
  <main>
    <section class="stats">
      <div class="stat">Total tests<b>${input.total}</b></div>
      <div class="stat">Passed<b>${input.passed}</b></div>
      <div class="stat">Failed<b>${input.failed}</b></div>
      <div class="stat">Blocked<b>${input.blocked}</b></div>
    </section>
    <h2>Role-wise results</h2>
    <table>
      <thead><tr><th>Role</th><th>Total</th><th>Passed</th><th>Failed</th><th>Blocked</th><th>Result</th></tr></thead>
      <tbody>${roleTable}</tbody>
    </table>
    <h2>Failed and blocked tests</h2>
    ${problemHtml}
    <h2>Passed tests</h2>
    <ul class="passed">${passedList || '<li>None.</li>'}</ul>
  </main>
</body>
</html>`;
  }
}

export default StabilityReporter;
