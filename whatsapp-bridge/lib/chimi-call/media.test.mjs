import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installMedia } from './media.mjs';

class Socket extends EventTarget {
  readyState = 1;
  sent = [];
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
  send(message) {
    assert.equal(this.readyState, 1);
    this.sent.push(JSON.parse(message));
  }
  receive(message) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
}

const accountSid = 'AC' + 'a'.repeat(32), streamSid = 'MZ' + '1'.repeat(32);
const start = { event: 'start', streamSid, start: { streamSid, accountSid,
  callSid: 'CA' + 'a'.repeat(32), mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 } } };
const tick = () => new Promise(resolve => setImmediate(resolve));
const audio = (payload = 'AAAA') => ({ event: 'media', streamSid, media: { track: 'inbound', payload } });

function bridge(authorizeStart = async () => ({ topic: 'Una prueba', agent: 'Lucas' })) {
  const twilio = new Socket(), ai = new Socket(), connections = [];
  const { close } = installMedia(twilio, { accountSid, apiKey: 'only-for-simulation', authorizeStart,
    makeAI(url, options) { connections.push({url, options}); return ai; } });
  return { twilio, ai, connections, close };
}

test('Reject foreign account, unsupported media format, expired transfer or duplicate start', async () => {
  for (const change of [{ accountSid: 'wrong' }, { mediaFormat: { channels: 2 } }, { callSid: '' }]) {
    const {twilio, connections} = bridge();
    twilio.receive({ ...start, start: { ...start.start, ...change } });
    assert.equal(twilio.readyState, 3);
    assert.equal(connections.length, 0);
  }
  const expired = bridge(async () => null);
  expired.twilio.receive(start);
  await tick();
  assert.equal(expired.twilio.readyState, 3);
  assert.equal(expired.connections.length, 0);

  const duplicate = bridge();
  duplicate.twilio.receive(start);
  duplicate.twilio.receive(start);
  await tick();
  assert.equal(duplicate.connections.length, 0);
  assert.equal(duplicate.twilio.readyState, 3);
});

test('A disconnect during async authorization never opens a paid AI session', async () => {
  let allow;
  const {twilio, connections} = bridge(() => new Promise(resolve => { allow = resolve; }));
  twilio.receive(start);
  twilio.close();
  allow({ topic: 'hola', agent: 'Lucas' });
  await tick();
  assert.equal(connections.length, 0);
});

test('Twilio start, greeting, bidirectional media, playback ack and cleanup', async () => {
  const {twilio, ai, connections} = bridge();
  twilio.receive({event: 'connected'});
  twilio.receive(audio());
  assert.equal(connections.length, 0);
  twilio.receive(start);
  twilio.receive(audio());
  await tick();
  assert.equal(connections.length, 1);
  assert.equal(connections[0].url, 'wss://api.openai.com/v1/live/sessions');
  assert.equal(ai.sent[0].session.audio.format.type, 'audio/pcmu');
  assert.equal(ai.sent[0].session.store, false);
  assert.equal(ai.sent.length, 1);
  ai.receive({type: 'session.started'});
  ai.receive({type: 'session.started'});
  assert.deepEqual(ai.sent.map(m => m.type), ['session.start', 'session.commentary.append','session.input_audio.append']);
  twilio.receive(audio('AQID'));
  assert.deepEqual(ai.sent.at(-1), { type: 'session.input_audio.append', audio: 'AQID' });
  twilio.receive({ ...audio('AAAA'), streamSid: 'other' });
  twilio.receive({ ...audio(), media: { track: 'outbound', payload: 'AAAA' } });
  assert.equal(ai.sent.length, 4);
  ai.receive({type: 'session.output_audio.delta', delta: 'AQID'});
  const [media, mark] = twilio.sent;
  assert.deepEqual(media, {event: 'media', streamSid, media: {payload: 'AQID'}});
  assert.equal(mark.event, 'mark');
  twilio.receive(mark);
  ai.receive({type: 'session.input_transcript.delta', start_ms: 300, end_ms: 500, delta: 'Hola'});
  assert.equal(twilio.sent.length, 2);
  twilio.receive({event: 'stop', streamSid});
  assert.equal(twilio.readyState, 3);
  assert.equal(ai.sent.at(-1).type, 'session.close');
  ai.receive({type: 'session.closed'});
  assert.equal(ai.readyState, 3);
});

test('An interruption flushes pending playback once; stale mark acknowledgements are harmless', async () => {
  const {twilio, ai, close} = bridge();
  twilio.receive(start);
  await tick();
  ai.receive({type: 'session.started'});
  const speech = (start_ms, end_ms) => ({ type: 'session.input_transcript.delta', delta: 'hola', start_ms, end_ms });
  ai.receive({type: 'session.output_audio.delta', delta: 'AAAA'});
  const old = twilio.sent.at(-1);
  ai.receive(speech(1000, 1240));
  assert.equal(twilio.sent.at(-1).event, 'clear');
  twilio.receive(old);
  ai.receive({type: 'session.output_audio.delta', delta: 'BBBB'});
  ai.receive(speech(1250, 1420));
  assert.equal(twilio.sent.at(-1).event, 'mark');
  ai.receive(speech(2320, 2450));
  assert.equal(twilio.sent.filter(m => m.event === 'clear').length, 2);
  close();
  ai.receive({type: 'session.closed'});
});

test('Bound startup and remote playback queues, close on invalid media', async () => {
  const {twilio, ai} = bridge();
  const big = Buffer.alloc(8000).toString('base64');
  twilio.receive(start);
  twilio.receive(audio(big));
  twilio.receive(audio(big));
  await tick();
  ai.receive({type: 'session.started'});
  assert.equal(ai.sent.filter(m => m.type === 'session.input_audio.append').length, 1);
  for (let i = 0; i < 2; i++) ai.receive({type: 'session.output_audio.delta', delta: big});
  assert.equal(twilio.sent.filter(m => m.event === 'clear').length, 1);
  twilio.receive(audio('?'));
  await tick();
  assert.equal(twilio.readyState, 3);
  ai.receive({type: 'session.closed'});
});

test('An unexpected OpenAI failure disconnects the call', async () => {
  const {twilio, ai} = bridge();
  twilio.receive(start);
  await tick();
  ai.receive({type: 'error'});
  assert.equal(twilio.readyState, 3);
  assert.equal(ai.readyState, 3);
});
