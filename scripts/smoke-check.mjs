// Run against an unconfigured local preview only. No real participant data is used.
import assert from 'node:assert/strict';
const origin=process.env.SMOKE_URL||'http://127.0.0.1:3000';
for(const route of ['/','/register','/participate','/participate?tab=special','/privacy','/organizer']){
  const response=await fetch(origin+route);assert.equal(response.status,200,route);console.log(`PASS page ${route}`);
}
const get=await fetch(origin+'/api/organizer');assert.equal(get.status,401);console.log('PASS organizer records protected');
const media=await fetch(origin+'/api/organizer/media?id=not-a-real-id');assert.equal(media.status,401);console.log('PASS private media protected');
const valid={childName:'Synthetic Test Child',age:10,parentName:'Synthetic Test Guardian',phone:'9000000000',locality:'Vizag test fixture',consent:true};
async function post(path,body,status,headers={}){const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});assert.equal(response.status,status,`${path}: ${await response.text()}`);}
await post('/api/register',{...valid,age:5},400);console.log('PASS minimum age enforced');
await post('/api/register',{...valid,age:16},400);console.log('PASS maximum age enforced');
await post('/api/register',{...valid,consent:false},400);console.log('PASS guardian consent required');
await post('/api/register',valid,403,{Origin:'https://unrelated.example'});console.log('PASS cross-origin write rejected');
await post('/api/register',valid,503);console.log('PASS missing storage fails honestly without saving');
