import {randomBytes} from 'node:crypto';
import {existsSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const path=resolve('.dev.vars');
if(!existsSync(path))writeFileSync(path,`SITE_ORIGIN=http://localhost:8787\nSETUP_TOKEN=${randomBytes(32).toString('hex')}\n`,{mode:0o600});
console.log('Configuración local lista. El código de habilitación está en .dev.vars (SETUP_TOKEN). No lo publiques.');
