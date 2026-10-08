import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const state=resolve('.wrangler','e2e-'+Date.now());
const env={...process.env,E2E_STATE:state,XDG_CONFIG_HOME:resolve('.wrangler/config'),WRANGLER_SEND_METRICS:'false'};
let r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','gesell','--local','--persist-to',state],{stdio:'inherit',env});if(r.status)process.exit(r.status);
r=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test'],{stdio:'inherit',env});process.exit(r.status||0);
