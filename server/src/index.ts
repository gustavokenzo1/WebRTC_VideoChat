import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface Room {
  [key: string]: Set<WebSocket>; // Mapeia o roomId para um conjunto de clientes
}

const rooms: Room = {}; // Objeto para armazenar as salas e os clientes conectados

wss.on('connection', (ws) => {
  console.log('Novo cliente conectado');

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    switch (data.type) {
      case 'join': {
        // Cliente se juntando a uma sala
        const { roomId } = data;

        if (!rooms[roomId]) {
          rooms[roomId] = new Set();
        }

        rooms[roomId].add(ws);
        console.log(`Usuário entrou na sala: ${roomId}`);
        break;
      }

      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        // Repasse de mensagens para outros clientes na mesma sala
        const { roomId } = data;

        if (rooms[roomId]) {
          rooms[roomId].forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
        break;
      }

      default:
        console.log('Tipo de mensagem desconhecido:', data.type);
    }
  });

  ws.on('close', () => {
    console.log('Cliente desconectado');
    // Remover cliente de todas as salas quando ele desconectar
    Object.keys(rooms).forEach((roomId) => {
      rooms[roomId].delete(ws);
      if (rooms[roomId].size === 0) {
        delete rooms[roomId]; // Se a sala estiver vazia, exclua-a
      }
    });
  });
});

server.listen(3000, () => {
  console.log('Servidor escutando na porta 3000');
});
