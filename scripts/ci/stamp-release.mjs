import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const sha=process.env.GITHUB_SHA;
assert.match(sha??'',/^[a-f0-9]{40}$/,'GITHUB_SHA is required');
assert.equal(process.env.GITHUB_REPOSITORY,'heruwaspodov/dolend');
const release={commit:sha,repository:process.env.GITHUB_REPOSITORY,run_id:process.env.GITHUB_RUN_ID??null,built_at:new Date().toISOString()};
await writeFile('out/release.json',JSON.stringify(release,null,2)+'\n');
console.log(`Stamped release ${sha.slice(0,7)}.`);
