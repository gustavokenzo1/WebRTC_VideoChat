import express from 'express';
import http from 'http';
import cors from 'cors'; 
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());

interface Room {
  clients: Set<WebSocket>;
  offer: RTCSessionDescriptionInit | null;
}

const rooms: { [key: string]: Room } = {};

wss.on('connection', (ws) => {
  let currentRoomId: string | null = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    switch (data.type) {
      case 'join':
        currentRoomId = data.roomId;

        if (!currentRoomId) {
          return;
        }

        if (!rooms[currentRoomId]) {
          rooms[currentRoomId] = { clients: new Set(), offer: null };
        }

        rooms[currentRoomId].clients.add(ws);
        console.log(`User ${data.username} joined room ${currentRoomId}`);

        if (rooms[currentRoomId].offer) {
          console.log('Sending offer to new client...');
          ws.send(
            JSON.stringify({
              type: 'offer',
              sdp: rooms[currentRoomId].offer?.sdp,
              roomId: currentRoomId,
            })
          );
        }
        break;

      case 'offer':
        if (rooms[data.roomId]) {
          rooms[data.roomId].offer = { type: 'offer', sdp: data.sdp };
          console.log(`Offer stored for room ${data.roomId}`);

          rooms[data.roomId].clients.forEach((client) => {
            if (client !== ws) {
              client.send(
                JSON.stringify({
                  type: 'offer',
                  sdp: data.sdp,
                  roomId: data.roomId,
                })
              );
            }
          });
        }
        break;

      case 'answer':
        console.log('Sending answer to all clients...');
        if (rooms[data.roomId]) {
          rooms[data.roomId].clients.forEach((client) => {
            if (client !== ws) {
              client.send(
                JSON.stringify({
                  type: 'answer',
                  sdp: data.sdp,
                  roomId: data.roomId,
                })
              );
            }
          });
        }
        break;

      case 'ice-candidate':
        if (rooms[data.roomId]) {
          rooms[data.roomId].clients.forEach((client) => {
            if (client !== ws) {
              client.send(
                JSON.stringify({
                  type: 'ice-candidate',
                  candidate: data.candidate,
                  sdpMid: data.sdpMid,
                  sdpMLineIndex: data.sdpMLineIndex,
                })
              );
            }
          });
        }
        break;

      case 'raise-hand':
        if (rooms[data.roomId]) {
          rooms[data.roomId].clients.forEach((client) => {
            if (client !== ws) {
              client.send(
                JSON.stringify({
                  type: 'raise-hand',
                  username: data.username,
                  handRaised: data.handRaised,
                })
              );
            }
          });
        }
        break;

      case 'mute-everyone':
        if (rooms[data.roomId]) {
          rooms[data.roomId].clients.forEach((client) => {
            if (client !== ws) {
              client.send(
                JSON.stringify({
                  type: 'mute-everyone',
                  muted: data.muted,
                })
              );
            }
          });
        }
        break;

      case 'mute-user':
        if (rooms[data.roomId]) {
          rooms[data.roomId].clients.forEach((client) => {
            if (client !== ws) {
              console.log('Sending mute-user message to client:', client);
              console.log('ws:', ws);
              client.send(
                JSON.stringify({
                  type: 'mute-user',
                  username: data.username,
                  muted: data.muted,
                })
              );
            }
          });
        }
        break;

      case 'chat-message':
        if (rooms[data.roomId]) {
          rooms[data.roomId].clients.forEach((client) => {
            if (client !== ws) {
              client.send(
                JSON.stringify({
                  type: 'chat-message',
                  username: data.username,
                  message: data.message,
                  roomId: data.roomId,
                })
              );
            }
          });
        }
        break;
    }
  });

  ws.on('close', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].clients.delete(ws);
      if (rooms[currentRoomId].clients.size === 0) {
        delete rooms[currentRoomId];
        console.log(`Room ${currentRoomId} was deleted as it's empty.`);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
