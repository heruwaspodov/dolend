import { randomUUID } from 'node:crypto';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const project=process.env.DATABASE_TEST_PROJECT_REF;
if(project!=='fpbefabsqryxmnmxufjw')throw new Error('Explicit Dolend project required');
const [owner,other,u1,u2]=Array.from({length:4},randomUUID);
let tests=await readFile('supabase/tests/dynamic-manual.sql','utf8');
for(const [a,b] of [['10000000-0000-4000-8000-000000000001',owner],['10000000-0000-4000-8000-000000000002',other],['20000000-0000-4000-8000-000000000001',u1],['20000000-0000-4000-8000-000000000002',u2]])tests=tests.replaceAll(a,b);
const sql=`begin;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values('${owner}','${owner}@example.invalid',now(),'{"provider":"google"}'),('${other}','${other}@example.invalid',now(),'{"provider":"google"}');
insert into public.users(id,display_name) values('${u1}','Manual owner fixture'),('${u2}','Manual member fixture');
insert into public.profiles(id,user_id) values('${owner}','${u1}'),('${other}','${u2}');
insert into public.workspaces(name,created_by_profile_id) values('Manual fixture','${owner}'),('Member fixture','${other}');
insert into public.workspace_members(workspace_id,profile_id,role) select id,created_by_profile_id,'owner' from public.workspaces where created_by_profile_id in ('${owner}','${other}');
${tests}
rollback;
select true as manual_finance_passed;`;
const directory=await mkdtemp(join(tmpdir(),'dolend-finance-'));
try{
 const file=join(directory,'test.sql');await writeFile(file,sql,{mode:0o600});
 const {stdout}=await promisify(execFile)('node_modules/.bin/supabase',['db','query','--linked','--project-ref',project,'--file',file,'--output','json'],{timeout:120000,maxBuffer:1024*1024});
 const result=JSON.parse(stdout);
 if(!JSON.stringify(result).includes('manual_finance_passed'))throw new Error('Missing finance result');
 console.log('PASS hosted manual finance transaction tests; fixtures rolled back');
 await writeFile('docs/manual-finance-hosted-results.json',JSON.stringify({project,date:'2026-10-31',passed:true,fixture_cleanup:'transaction rollback',scope:'PostgreSQL transaction rules; not concurrent API/storage end-to-end'},null,2)+'\n');
}finally{await rm(directory,{recursive:true,force:true});}
