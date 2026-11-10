import test from 'node:test';
import assert from 'node:assert/strict';
import {getConfig} from '../../src/config.mjs';

test('native configuration retains the original loopback port', () => {
  assert.deepEqual(getConfig(), {port:8630, host:'127.0.0.1', listenHost:'127.0.0.1', origin:'http://127.0.0.1:8630'});
});
test('Docker uses its dedicated port without widening the accepted browser origin', () => {
  assert.deepEqual(getConfig({RAILSYN_PORT:'8640', RAILSYN_BIND_HOST:'0.0.0.0'}), {port:8640, host:'127.0.0.1', listenHost:'0.0.0.0', origin:'http://127.0.0.1:8640'});
});
test('invalid port configuration is rejected', () => {
  for (const port of ['0','80','65536','8640.1','8640x','NaN','']) assert.throws(() => getConfig({RAILSYN_PORT:port}));
});
test('unexpected listen interfaces are rejected', () => {
  for (const host of ['localhost','192.168.1.2','::','']) assert.throws(() => getConfig({RAILSYN_BIND_HOST:host}));
});
