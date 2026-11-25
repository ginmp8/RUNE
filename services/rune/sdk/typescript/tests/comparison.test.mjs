import assert from 'node:assert/strict';
import test from 'node:test';
import { RuneClient } from '../src/index.ts';

test('creates an artifact-addressed asynchronous comparison job', async () => {
  const request = {
    left: { renderId: 'left-render', artifactName: 'document.pdf' },
    right: { renderId: 'right-render', artifactName: 'document.pdf' },
  };
  const accepted = { id: 'comparison-id', statusUrl: '/v1/comparisons/comparison-id', eventsUrl: '/v1/comparisons/comparison-id/events' };
  const calls = [];
  const client = new RuneClient('https://rune.example/', async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(accepted), { status: 202 });
  }, 'test-tenant');
  assert.deepEqual(await client.createComparison(request), accepted);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://rune.example/v1/comparisons');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['X-RUNE-Tenant'], 'test-tenant');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), request);
});

test('retired synchronous comparison fails without making a request', async () => {
  let calls = 0;
  const client = new RuneClient('https://rune.example', async () => {
    calls++;
    throw new Error('Unexpected request to retired endpoint');
  });
  await assert.rejects(() => client.compareArtifacts(), /Synchronous Base64 comparison was retired/);
  assert.equal(calls, 0);
});
