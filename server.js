import { Server } from 'socket.io';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 31415;
const RAG_URL = process.env.RAG_URL || 'http://localhost:3102';

console.log('🚀 HUPH Enterprise Chat Server starting...');
console.log('📡 Port:', PORT);
console.log('🤖 RAG URL:', RAG_URL);

const io = new Server(PORT, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

console.log(`✅ Socket.io server running on port ${PORT}`);

const chat = io.of('/chat');
let connectionCount = 0;

chat.on('connection', (socket) => {
  connectionCount++;
  console.log(`👤 User connected: ${socket.id} (total: ${connectionCount})`);
  
  socket.on('join', (conversationId) => {
    socket.join(conversationId);
  });
  
  socket.on('message', async (data) => {
    const { conversationId, message } = data;
    console.log(`💬 ${message.substring(0, 30)}...`);
    
    try {
      const response = await fetch(`${RAG_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, user_id: socket.id })
      });
      
      if (!response.ok) throw new Error('RAG error');
      
      const result = await response.json();
      const answer = result.answer || 'Maaf, tidak ada jawaban.';
      
      const words = answer.split(' ');
      let partial = '';
      
      for (let i = 0; i < words.length; i++) {
        partial += (i === 0 ? '' : ' ') + words[i];
        socket.emit('stream', { conversationId, content: partial, done: i === words.length - 1 });
        await new Promise(r => setTimeout(r, 25));
      }
      
      socket.emit('response', { conversationId, message: answer, sources: result.sources });
      
    } catch (error) {
      socket.emit('error', { conversationId, error: 'Terjadi kesalahan.' });
    }
  });
  
  socket.on('disconnect', () => {
    connectionCount--;
    console.log(`👋 User left (total: ${connectionCount})`);
  });
});

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'huph-webchat', connections: connectionCount }));
    return;
  }
  
  if (req.url === '/' || req.url === '/index.html') {
    const htmlPath = path.join(process.cwd(), 'public', 'index.html');
    fs.readFile(htmlPath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
  
  res.writeHead(404);
  res.end();
});

httpServer.listen(PORT + 1, () => console.log(`🌐 HTTP on port ${PORT + 1}`));
