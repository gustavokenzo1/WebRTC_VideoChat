import { useEffect, useRef } from 'react';

interface MeetProps {
  username: string;
  roomId: string;
}

const configuration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.ideasip.com' },
    { urls: 'stun:stun.sipgate.net' },
    { urls: 'stun:stun.ekiga.net' },
    { urls: 'stun:stun.iptel.org' },
    { urls: 'stun:stun.counterpath.net' },
  ],
};

export default function Meet({ username, roomId }: MeetProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

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

        ws.current.onmessage = (message) => {
          const data = JSON.parse(message.data);

          if (data.type === 'offer') {
            console.log('Offer recebido:', data);
            handleOffer(data.offer);
          } else if (data.type === 'answer') {
            console.log('Answer recebido:', data);
            handleAnswer(data.answer);
          } else if (data.type === 'ice-candidate') {
            console.log('Candidato ICE recebido:', data);
            handleIceCandidate(data.candidate);
          }
        };

        const handleOffer = async (offer: RTCSessionDescriptionInit) => {
          if (!peerConnection.current) return;

          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(offer)
          );

          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);

          ws.current?.send(JSON.stringify({ type: 'answer', answer }));
        };

        const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
          if (!peerConnection.current) return;

          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        };

        const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
          if (peerConnection.current) {
            await peerConnection.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          }
        };

        navigator.mediaDevices
          .getUserMedia({ video: true, audio: true })
          .then((stream) => {
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;

              peerConnection.current = new RTCPeerConnection(configuration);

              if (peerConnection.current) {
                stream.getTracks().forEach((track) => {
                  peerConnection.current?.addTrack(track, stream);
                });

                peerConnection.current.onicecandidate = (event) => {
                  if (event.candidate) {
                    console.log('Candidato ICE gerado:', event.candidate);

                    ws.current?.send(
                      JSON.stringify({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                      })
                    );
                  }
                };
              }
            }
          })
          .catch((error) => {
            console.error('Erro ao acessar mídia:', error);
          });
      } catch (error) {
        console.error('Falha ao conectar ao WebSocket:', error);
      }
    };

    connect();
  }, [username, roomId]);

  return (
    <div className="w-screen h-screen bg-cyan-900 flex flex-col items-center justify-center text-white">
      <video
        autoPlay
        playsInline
        className="rounded-lg mt-4"
        ref={localVideoRef}
        muted
      ></video>
    </div>
  );
}
