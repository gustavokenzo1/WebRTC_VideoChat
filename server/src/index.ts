import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface Room {
  [key: string]: Set<WebSocket>; // Mapeia o roomId para um conjunto de clientes
}

const rooms: Room = {}; // Objeto para armazenar as salas e os clientes conectados

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    switch (data.type) {
      case 'join':
        // Verifica se a sala já existe, se não, cria uma nova
        if (!rooms[data.roomId]) {
          rooms[data.roomId] = new Set();
        }
        rooms[data.roomId].add(ws); // Adiciona o cliente à sala
        console.log(`Usuário ${data.username} entrou na sala ${data.roomId}`);
        break;

      case 'offer':
        // Verifica se a sala existe antes de enviar a oferta
        if (rooms[data.roomId]) {
          rooms[data.roomId].forEach(client => {
            if (client !== ws) {
              client.send(JSON.stringify({ type: 'offer', sdp: data.sdp }));
            }
          });
        } else {
          console.error(`Sala ${data.roomId} não encontrada para enviar offer.`);
        }
        break;

      case 'answer':
        // Verifica se a sala existe antes de enviar a resposta
        if (rooms[data.roomId]) {
          rooms[data.roomId].forEach(client => {
            if (client !== ws) {
              client.send(JSON.stringify({ type: 'answer', sdp: data.sdp }));
            }
          });
        } else {
          console.error(`Sala ${data.roomId} não encontrada para enviar answer.`);
        }
        break;

      case 'ice-candidate':
        // Verifica se a sala existe antes de enviar o ICE Candidate
        if (rooms[data.roomId]) {
          rooms[data.roomId].forEach(client => {
            if (client !== ws) {
              client.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: data.candidate,
                sdpMid: data.sdpMid,
                sdpMLineIndex: data.sdpMLineIndex,
              }));
            }
          });
        } else {
          console.error(`Sala ${data.roomId} não encontrada para enviar ICE candidate.`);
        }
        break;
    }
  });

  // Quando o WebSocket é fechado, remove o cliente da sala
  ws.on('close', () => {
    for (const roomId in rooms) {
      rooms[roomId].delete(ws);
      if (rooms[roomId].size === 0) {
        delete rooms[roomId]; // Remove a sala se estiver vazia
        console.log(`Sala ${roomId} foi removida por estar vazia.`);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Servidor escutando na porta 3000');
});
