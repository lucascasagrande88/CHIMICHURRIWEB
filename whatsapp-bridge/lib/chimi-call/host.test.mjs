import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {validUpgrade, route} from './host.mjs';
test('Twilio firma únicamente la ruta fija y rechaza orígenes arbitrarios',()=>{
  const secret='local-mock-token';
  const sign=url=>createHmac('sha1',secret).update(url).digest('base64');
  assert.ok(validUpgrade(sign('https://chimichurriweb.vercel.app/api/chimi-call/media'),secret));
  assert.ok(!validUpgrade(sign('https://example.invalid/api/chimi-call/media'),secret));
  assert.ok(!validUpgrade('',secret));
});
test('Una petición sin autenticación no puede marcar ni consultar la configuración',async()=>{
  const response={setHeader(){},status(n){this.code=n;return this},json(body){this.body=body;return this}};
  for(const action of ['call','check']){
    await route(action)({method:'POST',headers:{}},response);
    assert.equal(response.code,401);
  }
});
