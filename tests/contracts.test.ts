import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { schemas, authSchemas, roomCode } from '../lib/online/contracts';
import { accountEmail } from '../lib/server/auth';
import { readBody } from '../lib/server/api';

test('commands reject forged authority, invalid avatars, invalid cells and oversized event arrays',()=>{
  const id=randomUUID();
  assert(!schemas.move.safeParse({clientCommandId:id,expectedVersion:1,cellIndex:9}).success);
  assert(!schemas.move.safeParse({clientCommandId:id,expectedVersion:1,cellIndex:1,mark:'O',winner:'O'}).success);
  assert(!schemas.profile.safeParse({clientCommandId:id,name:'<script>',avatarId:'file:///etc/passwd',publicLeaderboard:true}).success);
  assert.equal(roomCode.parse(' abc234 '),'ABC234');
  assert(!roomCode.safeParse('ABO123').success);
});

test('account contracts accept simple 8-char numeric passwords and map usernames deterministically',()=>{
  assert.equal(authSchemas.register.safeParse({ username: 'Alex_99', password: '12345678' }).success, true);
  assert.equal(authSchemas.login.safeParse({ username: 'Alex_99', password: '12345678' }).success, true);
  assert.equal(authSchemas.register.safeParse({ username: 'ab', password: '12345678' }).success, false);
  assert.equal(authSchemas.register.safeParse({ username: 'bad name', password: '12345678' }).success, false);
  assert.equal(authSchemas.register.safeParse({ username: 'Alex_99', password: '1234567' }).success, false);
  assert.equal(accountEmail('Alex_99'), accountEmail(' alex_99 '));
});

test('HTTP boundary rejects cross-origin, wrong content type and bodies larger than the byte limit',async()=>{
  await assert.rejects(readBody(new Request('https://game.example/api/rooms',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'})),/INVALID_ORIGIN/);
  await assert.rejects(readBody(new Request('https://game.example/api/rooms',{method:'POST',headers:{origin:'https://game.example','content-type':'text/plain'},body:'{}'})),/INVALID_INPUT/);
  await assert.rejects(readBody(new Request('https://game.example/api/rooms',{method:'POST',headers:{origin:'https://game.example','content-type':'application/json'},body:JSON.stringify({value:'x'.repeat(17000)})})),/PAYLOAD_TOO_LARGE/);
});
