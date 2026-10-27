import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
const exec=promisify(execFile);
const sql=`select jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'type',data_type,'nullable',is_nullable,'default',column_default) order by table_name,ordinal_position) from information_schema.columns where table_schema='public'),
 'constraints',(select jsonb_agg(jsonb_build_object('table',cl.relname,'name',con.conname,'definition',pg_get_constraintdef(con.oid))) from pg_constraint con join pg_class cl on cl.oid=con.conrelid join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public'),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'search_path',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'execute'),'member_execute',has_function_privilege('authenticated',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'unindexed_fks',(select count(*) from pg_constraint con join pg_class cl on cl.oid=con.conrelid join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public' and con.contype='f' and not exists(select 1 from pg_index idx where idx.indrelid=con.conrelid and idx.indisvalid and idx.indkey[0]=con.conkey[1])),
 'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as catalog`;
const result=await exec('node_modules/.bin/supabase',['db','query','--linked','--project-ref','fpbefabsqryxmnmxufjw',sql,'--output','json'],{timeout:120000,maxBuffer:1024*1024});
const catalog=JSON.parse(result.stdout).rows[0].catalog;
if(catalog.tables.some(t=>!t.rls)||catalog.unindexed_fks!==0||catalog.functions.some(f=>f.anon_execute||f.member_execute))throw new Error('Catalog security/index invariant failed');
const escape=value=>String(value??'—').replaceAll('|','\\|').replaceAll('\n',' ');
let text='# Dolend data dictionary\n\nGenerated from the hosted public schema on 27 October 2026. No user data is included. All business tables have UUID primary keys and RLS enabled. Domain RPC execute is service-only; browser read scope is documented in DATABASE.md.\n';
for(const table of catalog.tables.sort((a,b)=>a.name.localeCompare(b.name))){
 text+=`\n## ${table.name}\n\n| Column | Type | Nullable | Default |\n| --- | --- | --- | --- |\n`;
 for(const col of catalog.columns.filter(c=>c.table===table.name))text+=`| ${col.name} | ${col.type} | ${col.nullable} | ${escape(col.default)} |\n`;
 text+='\nConstraints:\n\n';
 for(const constraint of catalog.constraints.filter(c=>c.table===table.name))text+=`- \`${constraint.name}\`: ${escape(constraint.definition)}\n`;
}
await writeFile('docs/DATA-DICTIONARY.md',text);
const summary={tables:catalog.tables.length,all_rls:true,unindexed_foreign_keys:catalog.unindexed_fks,service_only_rpc:catalog.functions.map(f=>f.name),migration_versions:catalog.migrations};
await writeFile('docs/database-catalog-results.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
