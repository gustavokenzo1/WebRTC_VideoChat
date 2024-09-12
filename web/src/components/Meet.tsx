import { useEffect, useRef } from 'react';

interface MeetProps {
  username: string;
  roomId: string;
  mode: string;
}

const servers: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

const connectWebSocket = (url: string): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('WebSocket conectado');
      resolve(socket);
    };

    socket.onerror = (error) => {
      console.error('Erro na conexão WebSocket:', error);
      reject(error);
    };
  });
};

export default function Meet({ username, roomId, mode }: MeetProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(
    new RTCPeerConnection(servers)
  );

  async function getUserLocalMedia() {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream.getTracks().forEach((track) => {
        if (peerConnection.current) {
          peerConnection.current.addTrack(track, localStream);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    } catch (error) {
      console.error('Erro ao obter mídia local:', error);
    }
  }

  function getUserRemoteMedia() {
    const remoteStream = new MediaStream();

    if (peerConnection.current && remoteVideoRef.current) {
      peerConnection.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          console.log('Recebendo track remota:', track);
          remoteStream.addTrack(track);
        });
      };

      remoteVideoRef.current.srcObject = remoteStream;
    }
  }

  async function handleCreateOffer() {
    if (peerConnection.current) {
      peerConnection.current.onicecandidate = (event) => {
        event.candidate &&
          ws.current?.send(
            JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate,
            })
          );
      };

      const offerDescription = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offerDescription);

      ws.current?.send(
        JSON.stringify({
          type: 'offer',
          roomId,
          sdp: offerDescription.sdp,
        })
      );
      console.log('Offer criado e enviado:', offerDescription);
    }
  }

  async function handleReceiveOffer(offer: RTCSessionDescriptionInit) {
    if (peerConnection.current) {
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answerDescription = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answerDescription);

      ws.current?.send(
        JSON.stringify({
          type: 'answer',
          roomId,
          sdp: answerDescription.sdp,
        })
      );
      console.log('Answer criado e enviado:', answerDescription);
    }
  }

  useEffect(() => {
    const connect = async () => {
      try {
        ws.current = await connectWebSocket('ws://localhost:3000');

        ws.current.send(
          JSON.stringify({
            type: 'join',
            username,
            roomId,
          })
        );

        if (mode === 'local') {
          handleCreateOffer();
        }

        ws.current.onmessage = (message) => {
          const data = JSON.parse(message.data);

          if (data.type === 'offer' && mode === 'answer') {
            console.log('Recebido offer, criando answer...');
            handleReceiveOffer({
              type: 'offer',
              sdp: data.sdp,
            });
          } else if (data.type === 'answer') {
            const remoteDesc = new RTCSessionDescription({
              type: 'answer',
              sdp: data.sdp,
            });
            console.log('Recebido answer, definindo remote description...');
            peerConnection.current?.setRemoteDescription(remoteDesc);
          } else if (data.type === 'ice-candidate') {
            const candidate = new RTCIceCandidate({
              candidate: data.candidate,
              sdpMid: data.sdpMid,
              sdpMLineIndex: data.sdpMLineIndex,
            });
            console.log('Adicionando ICE candidate:', candidate);
            peerConnection.current?.addIceCandidate(candidate);
          }
        };
      } catch (error) {
        console.error('Falha ao conectar ao WebSocket:', error);
      }
    };

    connect();
    getUserLocalMedia();
    getUserRemoteMedia();
  }, [username, roomId, mode]);

  return (
    <div className="w-screen h-screen bg-cyan-900 flex flex-row p-8 gap-4 items-center justify-center text-white">
      <video
        autoPlay
        playsInline
        className="rounded-lg mt-4 w-1/2"
        ref={localVideoRef}
        muted
      ></video>
      <video
        autoPlay
        playsInline
        className="rounded-lg mt-4 w-1/2 bg-cyan-800"
        ref={remoteVideoRef}
      ></video>
    </div>
  );
}
