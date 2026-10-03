
import crypto from 'crypto';
import fs from 'fs';
const A='0xF7e98d9e23406845E2B0e90D730b824e961dDEfB';
const r=await fetch(`https://explorer-studio-dev.genlayer.com/api/address/${A}`);
const cc=(await r.json()).contract_code || '';
const local = fs.readFileSync('/home/administrator/proposal-precheck/contracts/proposal_precheck_v3.py','utf8');
const gh   = fs.readFileSync('/tmp/gh.py','utf8');
const h=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,24);
console.log('GitHub  :', h(gh),   gh.split('\n').length,   'lines');
console.log('local   :', h(local), local.split('\n').length, 'lines');
console.log('deployed:', h(cc),   cc.split('\n').length,   'lines');
console.log('local == deployed  :', local.trim() === cc.trim());
console.log('github == deployed :', gh.trim() === cc.trim());
