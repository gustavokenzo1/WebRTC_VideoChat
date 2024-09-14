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
  let iceCandidateBuffer: RTCIceCandidate[] = [];

  let localStream: MediaStream | null = null;
  let remoteStream: MediaStream | null = null;

  const ws = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(
    new RTCPeerConnection(servers)
  );

  async function getUserLocalMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream.getTracks().forEach((track) => {
        if (peerConnection.current) {

          if(localStream) {
          peerConnection.current.addTrack(track, localStream);
          }
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
    remoteStream = new MediaStream();

    if (peerConnection.current && remoteVideoRef.current) {
      peerConnection.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          if(remoteStream){
          console.log('Recebendo track remota:', track);
          remoteStream.addTrack(track);
        }
        });
      };

      remoteVideoRef.current.srcObject = remoteStream;
    }
  }

  async function handleCreateOffer() {
    if (peerConnection.current) {
      try {
        await getUserLocalMedia();
  
        const offerDescription = await peerConnection.current.createOffer();
        
        await peerConnection.current.setLocalDescription(offerDescription);
        console.log('Local description set:', offerDescription);
  
        ws.current?.send(
          JSON.stringify({
            type: 'offer',
            roomId,
            sdp: offerDescription.sdp,
          })
        );
        console.log('Offer created and sent:', offerDescription);
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  }

  async function handleReceiveOffer(offer: RTCSessionDescriptionInit) {
    if (peerConnection.current) {
      console.log('Signaling state before setting remote offer:', peerConnection.current.signalingState);
  
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('Offer successfully set as remote description.');
      } catch (error) {
        console.error('Failed to set remote description:', error);
        return;
      }
  
      console.log('Signaling state after setting remote offer:', peerConnection.current.signalingState);
  
      getUserRemoteMedia();
  
      if (peerConnection.current.signalingState === 'have-remote-offer') {
        try {
          const answerDescription = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answerDescription).then(() => {
            console.log('Local description set:', answerDescription);
          });
  
          ws.current?.send(
            JSON.stringify({
              type: 'answer',
              roomId,
              sdp: answerDescription.sdp,
            })
          );

          iceCandidateBuffer.forEach((candidate) => {
            ws.current?.send(
              JSON.stringify({
                type: 'ice-candidate',
                candidate,
                roomId,
              })
            );
          });
      
          // Clear the buffer once sent
          iceCandidateBuffer = [];

          console.log('Answer created and sent:', answerDescription);
        } catch (error) {
          console.error('Failed to create or set local description for answer:', error);
        }
      } else {
        console.warn('Unexpected signaling state after receiving offer:', peerConnection.current.signalingState);
      }
    }
  }
  

  useEffect(() => {

    if(peerConnection && peerConnection.current) {
      peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {

        console.log('stored ICE candidate:', event.candidate);
        iceCandidateBuffer.push(event.candidate);
        
      } else {
        console.log('ICE candidate gathering completed.');
      }
    };

    peerConnection.current.onicegatheringstatechange = () => {

      if (!peerConnection.current) return;
      console.log('ICE gathering state changed to:', peerConnection.current.iceGatheringState);
      if (peerConnection.current.iceGatheringState === 'complete') {
        console.log('ICE gathering complete.');
      }
    };
    }
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
  
        ws.current.onmessage = async (message) => {
          const data = JSON.parse(message.data);
  
          console.log(data , mode)
          if (data.type === 'offer' && mode === 'remote') {
            console.log('Received offer, setting remote description...');
            await handleReceiveOffer({
              type: 'offer',
              sdp: data.sdp,
            });
          }
          if(peerConnection && peerConnection.current) {
          if (data.type === 'answer' && mode === 'local') {
            console.log('Received answer, setting remote description...');
            const answerDescription = new RTCSessionDescription({
              type: 'answer',
              sdp: data.sdp,
            });
            await peerConnection.current.setRemoteDescription(answerDescription);


          iceCandidateBuffer.forEach((candidate) => {
            ws.current?.send(
              JSON.stringify({
                type: 'ice-candidate',
                candidate,
                roomId,
              })
            );
          });
      
          // Clear the buffer once sent
          iceCandidateBuffer = [];


            console.log('Remote description set:', answerDescription);
          }
  
          if (data.type === 'ice-candidate') {
            const candidate = new RTCIceCandidate({
              candidate: data.candidate.candidate,
              sdpMid: data.candidate.sdpMid,
              sdpMLineIndex: data.candidate.sdpMLineIndex,
            });
            console.log('Adding ICE candidate:', candidate);
            peerConnection.current.addIceCandidate(candidate);
          }
        };
        }
  
        
        if(peerConnection && peerConnection.current) {
        peerConnection.current.onconnectionstatechange = () => {
          if (!peerConnection.current) return;
          console.log('Connection state change:', peerConnection.current.connectionState);
          if (peerConnection.current.connectionState === 'connected') {
            console.log('Peers are connected!');
          } else if (peerConnection.current.connectionState === 'disconnected' || peerConnection.current.connectionState === 'failed') {
            console.error('Connection failed or disconnected');
          }
        };
      }
  
        if (mode === 'local') {
          console.log('Creating offer...');
          await handleCreateOffer();
        }
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
      }
    };
  
    getUserLocalMedia();
    getUserRemoteMedia();
    connect();
  
  }, [username, roomId, mode]);
  

  return (
    <div className="w-screen h-screen bg-cyan-900 flex flex-row p-8 gap-4 items-center justify-center text-white">
      <p>ID da sala: {roomId}</p>
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
