import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { authorizeStart, validUpgrade } from '../../lib/chimi-call/host.mjs';
import { installMedia } from '../../lib/chimi-call/media.mjs';

const server = createServer((_req, res) => { res.writeHead(426, { 'Cache-Control': 'no-store' }); res.end(); });
const wss = new WebSocketServer({ noServer:true, perMessageDeflate:false, maxPayload:100 * 1024 });
server.on('upgrade',(req,socket,head) => {
  const env = process.env;
  if (!validUpgrade(req.headers['x-twilio-signature'], env.TWILIO_AUTH_TOKEN) || !env.OPENAI_API_KEY) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
  }
  wss.handleUpgrade(req,socket,head,ws => {
    installMedia(ws,{accountSid:env.TWILIO_ACCOUNT_SID,apiKey:env.OPENAI_API_KEY,authorizeStart,
      makeAI:(url,opts) => new WebSocket(url,{...opts,perMessageDeflate:false,maxPayload:100*1024})});
  });
});
export default server;
