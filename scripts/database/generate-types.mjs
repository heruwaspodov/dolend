import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, rename } from 'node:fs/promises';
const {stdout}=await promisify(execFile)('node_modules/.bin/supabase',['gen','types','--project-id','fpbefabsqryxmnmxufjw','--schema','public'],{timeout:120000,maxBuffer:4*1024*1024});
if(!stdout.includes('export type Database'))throw new Error('Type generation did not return a Database definition');
const temporary='src/lib/database.types.ts.tmp';
await writeFile(temporary,'// Generated from Supabase public schema; regenerate after migrations.\n'+stdout);
await rename(temporary,'src/lib/database.types.ts');
console.log('Updated TypeScript database contracts.');
