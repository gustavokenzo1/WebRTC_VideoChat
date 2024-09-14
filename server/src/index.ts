import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface Room {
  clients: Set<WebSocket>; // Store all clients (peers) in this room
  offer: RTCSessionDescriptionInit | null; // Store the current offer, if any
}

const rooms: { [key: string]: Room } = {}; // Object to store rooms and their clients + offer

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

        // Check if the room exists, if not create a new one
        if (!rooms[currentRoomId]) {
          rooms[currentRoomId] = { clients: new Set(), offer: null };
        }
        
        // Add the new client to the room
        rooms[currentRoomId].clients.add(ws);
        console.log(`User ${data.username} joined room ${currentRoomId}`);
        
        // If an offer already exists, send it to the newly joined client
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
        // Store the offer in the room
        if (rooms[data.roomId]) {
          rooms[data.roomId].offer = { type: 'offer', sdp: data.sdp };
          console.log(`Offer stored for room ${data.roomId}`);
          
          // Broadcast the offer to all clients except the sender
          rooms[data.roomId].clients.forEach(client => {
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
        // Broadcast the answer to all clients in the room except the sender
        console.log('Sending answer to all clients...');
        if (rooms[data.roomId]) {
          rooms[data.roomId].clients.forEach(client => {
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
        // Broadcast the ICE candidate to all clients in the room except the sender
        if (rooms[data.roomId]) {
          rooms[data.roomId].clients.forEach(client => {
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
    }
  });

  // When the WebSocket is closed, remove the client from the room
  ws.on('close', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].clients.delete(ws);
      if (rooms[currentRoomId].clients.size === 0) {
        delete rooms[currentRoomId]; // Remove the room if it's empty
        console.log(`Room ${currentRoomId} was deleted as it's empty.`);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
