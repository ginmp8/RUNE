import { pathToFileURL } from 'node:url';

const [packageEntry] = process.argv.slice(2);
if (!packageEntry) throw new Error('SchemaTex package entry is required.');
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const module = await import(pathToFileURL(packageEntry).href);
for (const name of ['render', 'renderPreview', 'renderResult']) {
  if (typeof module[name] !== 'function') throw new Error(`SchemaTex export ${name} is missing.`);
}
const result = await module.renderResult(input.source, input.options ?? {});
process.stdout.write(JSON.stringify(result));
