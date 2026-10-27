import assert from 'node:assert/strict';
const sha=process.env.GITHUB_SHA;assert.match(sha??'',/^[a-f0-9]{40}$/);
let failure='Release not available';
for(let attempt=0;attempt<6;attempt++){
 try{
  const release=await fetch(`https://dolend.web.app/release.json?v=${sha}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  assert(release.ok,`Release metadata HTTP ${release.status}`);
  assert.equal((await release.json()).commit,sha,'Live commit does not match this build');
  const landing=await fetch('https://dolend.web.app/',{cache:'no-store',signal:AbortSignal.timeout(10000)});
  assert(landing.ok&& (await landing.text()).includes('Dolend'),'Live landing failed');
  console.log(`Live verified: https://dolend.web.app/ at ${sha.slice(0,7)}`);process.exit(0);
 }catch(error){failure=error.message;if(attempt<5)await new Promise(resolve=>setTimeout(resolve,5000));}
}
throw new Error(failure);
