import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
function walk(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]); }
for (const file of walk('src')) {
 const source=readFileSync(file,'utf8');
 assert(!/VITE_(?:GROQ|SARVAM|.*SECRET|.*SERVICE_ROLE)/i.test(source),`${file}: private browser configuration`);
 assert(!/dangerouslySetInnerHTML|insertAdjacentHTML|\.innerHTML\s*=/.test(source),`${file}: unsafe HTML sink`);
 assert(!/https:\/\/api\.(?:groq|sarvam)\./.test(source),`${file}: direct provider access`);
}
for (const file of walk('.github/workflows')) {
 const source=readFileSync(file,'utf8');
 assert(!/pull_request_target/.test(source),'Privileged PR workflow is prohibited');
 for (const match of source.matchAll(/uses:\s*([^\s]+)/g)) assert(/@[a-f0-9]{40}$/.test(match[1]),'Pin third-party actions to a commit');
}
console.log('Browser boundary and workflow policy checks passed (not an exhaustive security scan).');
