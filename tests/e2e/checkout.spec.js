import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

for (const scenario of ['success', 'error']) test(`checkout ${scenario}`, async ({ page }, info) => {
  const traceId = randomBytes(16).toString('hex');
  const parentSpanId = randomBytes(8).toString('hex');
  const runId = `${process.env.LAB_RUN_ID}-${scenario}`;
  await page.addInitScript(({ runId, traceparent }) => { window.labRunId = runId; window.labTraceparent = traceparent; }, { runId, traceparent: `00-${traceId}-${parentSpanId}-01` });
  await page.goto('/');
  await page.selectOption('#scenario', scenario);
  const responsePromise = page.waitForResponse(r => r.url().includes('/api/checkout'));
  await page.getByRole('button', { name: 'Run checkout' }).click();
  const response = await responsePromise;
  const body = await response.json();
  await expect(page.locator('#result')).toContainText(body.message);
  const screenshot = info.outputPath('checkout.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  const record = { schema_version: 1, scenario, test_run_id: runId, trace_id: traceId, parent_span_id: parentSpanId, actual_status: response.status(), expected_status: 200, outcome: response.status() === 200 ? 'PASS' : 'FAIL', injected_failure: scenario === 'error', body, screenshot };
  mkdirSync(process.env.EVIDENCE_DIR, { recursive: true });
  writeFileSync(`${process.env.EVIDENCE_DIR}/${scenario}.json`, JSON.stringify(record, null, 2));
  await info.attach('correlation-evidence', { body: JSON.stringify(record), contentType: 'application/json' });
  expect(body.test_run_id).toBe(runId);
  expect(body.trace_id).toBe(traceId);
  expect(response.status()).toBe(scenario === 'error' ? 500 : 200);
  // Mark only the final business assertion: setup/correlation errors remain unexpected.
  if (scenario === 'error' && !process.env.LAB_RAW_FAILURE) test.fail(true, 'Deliberate 500: checkout business assertion must fail');
  expect(response.status(), 'Business expectation: checkout succeeds').toBe(200);
});
