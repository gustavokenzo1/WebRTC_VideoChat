import {
  faHandPaper,
  faHandRock,
  faMicrophone,
  faMicrophoneSlash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';

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
  const iceCandidateBuffer: RTCIceCandidate[] = [];

  const [remoteRaiseHand, setRemoteRaiseHand] = useState<boolean>(false);

  let localStream: MediaStream | null = null;
  let remoteStream: MediaStream | null = null;

  const ws = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(
    new RTCPeerConnection(servers)
  );

  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);

  // Novo estado para controle do compartilhamento de tela
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  let screenTrack: MediaStreamTrack | null = null;

  // Estados para o chat
  const [messages, setMessages] = useState<
    { username: string; message: string }[]
  >([]);
  const [newMessage, setNewMessage] = useState('');

  const toggleRaiseHand = () => {
    setIsHandRaised(!isHandRaised);

    ws.current?.send(
      JSON.stringify({
        type: 'raise-hand',
        username,
        handRaised: !isHandRaised,
        roomId,
      })
    );
  };

  const toggleMute = () => {
    ws.current?.send(
      JSON.stringify({
        type: 'mute-user',
        username,
        muted: !isMuted,
        roomId,
      })
    );
    setIsMuted(!isMuted);

    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
  };

  function muteRemoteAudio(muted: boolean) {
    setIsRemoteMuted(muted);
  }

  async function startScreenShare() {
    if (!isScreenSharing) {
      try {
        if (!navigator.mediaDevices.getDisplayMedia) {
          alert('Seu navegador não suporta compartilhamento de tela.');
          return;
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        screenTrack = screenStream.getVideoTracks()[0];

        const sender = peerConnection.current
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');

        if (sender && screenTrack) {
          await sender.replaceTrack(screenTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (error) {
        console.error('Erro ao compartilhar a tela:', error);
      }
    } else {
      stopScreenShare();
    }
  }

  async function stopScreenShare() {
    if (screenTrack) {
      screenTrack.stop();
    }

    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const cameraTrack = cameraStream.getVideoTracks()[0];

    const sender = peerConnection.current
      ?.getSenders()
      .find((s) => s.track?.kind === 'video');

    if (sender && cameraTrack) {
      await sender.replaceTrack(cameraTrack);
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = cameraStream;
    }

    localStream = cameraStream;

    setIsScreenSharing(false);
  }

  async function getUserLocalMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream.getTracks().forEach((track) => {
        if (peerConnection.current) {
          peerConnection.current.addTrack(track, localStream as MediaStream);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    } catch (error) {
      console.error('Erro ao obter mídia local:', error);
    }
  }

  useEffect(() => {
    if (peerConnection && peerConnection.current) {
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          ws.current?.send(
            JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate,
              roomId,
            })
          );

          iceCandidateBuffer.push(event.candidate);
        } else {
          console.log('ICE candidate gathering completed.');
        }
      };

      peerConnection.current.onicegatheringstatechange = () => {
        if (!peerConnection.current) return;
        console.log(
          'ICE gathering state changed to:',
          peerConnection.current.iceGatheringState
        );
        if (peerConnection.current.iceGatheringState === 'complete') {
          console.log('ICE gathering complete.');
        }
      };

      // Configurando o stream remoto e o manipulador ontrack
      remoteStream = new MediaStream();

      peerConnection.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream?.addTrack(track);
        });
      };

      // Definindo o srcObject do elemento de vídeo remoto
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      peerConnection.current.onconnectionstatechange = () => {
        if (!peerConnection.current) return;
        console.log(
          'Connection state change:',
          peerConnection.current.connectionState
        );
        if (peerConnection.current.connectionState === 'connected') {
          console.log('Peers are connected!');
        } else if (
          peerConnection.current.connectionState === 'disconnected' ||
          peerConnection.current.connectionState === 'failed'
        ) {
          console.error('Connection failed or disconnected');
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

          console.log(data, mode);
          if (data.type === 'offer' && mode === 'remote') {
            console.log('Received offer, setting remote description...');
            await handleReceiveOffer({
              type: 'offer',
              sdp: data.sdp,
            });
          }
          if (peerConnection && peerConnection.current) {
            if (data.type === 'answer' && mode === 'local') {
              console.log('Received answer, setting remote description...');
              const answerDescription = new RTCSessionDescription({
                type: 'answer',
                sdp: data.sdp,
              });
              await peerConnection.current.setRemoteDescription(
                answerDescription
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

              console.log('Remote description set:', answerDescription);
            }

            if (data.type === 'ice-candidate') {
              const candidate = new RTCIceCandidate({
                candidate: data.candidate.candidate,
                sdpMid: data.candidate.sdpMid,
                sdpMLineIndex: data.candidate.sdpMLineIndex,
              });
              console.log('Adding ICE candidate:', candidate);
              await peerConnection.current.addIceCandidate(candidate);
            }
          }

          if (data.type === 'raise-hand') {
            console.log(
              `${data.username} has ${
                data.handRaised ? 'raised' : 'lowered'
              } their hand.`
            );

            // Verifica se a mensagem não é do usuário local
            if (data.username !== username) {
              setRemoteRaiseHand(data.handRaised);
            }
          }

          if (data.type === 'mute-user') {
            console.log(
              `Received mute-user for ${data.username}. Muted: ${data.muted}`
            );

            if (data.username !== username) {
              muteRemoteAudio(data.muted);
            }
          }

          if (data.type === 'chat-message') {
            console.log(
              `Received chat message from ${data.username}: ${data.message}`
            );
            setMessages((prevMessages) => [
              ...prevMessages,
              { username: data.username, message: data.message },
            ]);
          }
        };

        if (mode === 'local') {
          console.log('Creating offer...');
          await handleCreateOffer();
        }
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
      }
    };

    connect();
  }, [username, roomId, mode]);

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
      console.log(
        'Signaling state before setting remote offer:',
        peerConnection.current.signalingState
      );

      try {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        console.log('Offer successfully set as remote description.');
      } catch (error) {
        console.error('Failed to set remote description:', error);
        return;
      }

      console.log(
        'Signaling state after setting remote offer:',
        peerConnection.current.signalingState
      );

      // Chame getUserLocalMedia aqui
      await getUserLocalMedia();

      if (peerConnection.current.signalingState === 'have-remote-offer') {
        try {
          const answerDescription = await peerConnection.current.createAnswer();
          await peerConnection.current
            .setLocalDescription(answerDescription)
            .then(() => {
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
            console.log('Sending stored ICE candidate:', candidate);
            ws.current?.send(
              JSON.stringify({
                type: 'ice-candidate',
                candidate,
                roomId,
              })
            );
          });

          console.log('Answer created and sent:', answerDescription);
        } catch (error) {
          console.error(
            'Failed to create or set local description for answer:',
            error
          );
        }
      } else {
        console.warn(
          'Unexpected signaling state after receiving offer:',
          peerConnection.current.signalingState
        );
      }
    }
  }

  const sendMessage = () => {
    if (ws.current && newMessage.trim() !== '') {
      ws.current.send(
        JSON.stringify({
          type: 'chat-message',
          username,
          message: newMessage,
          roomId,
        })
      );
      // Opcional: adicionar a mensagem ao estado local
      setMessages((prevMessages) => [
        ...prevMessages,
        { username, message: newMessage },
      ]);
      setNewMessage('');
    }
  };

  return (
    <div className="w-screen h-screen bg-cyan-900 flex text-white">
      {/* Sidebar */}
      <div className="w-1/4 h-full flex flex-col p-4 gap-4 bg-gray-800">
        <p>ID da sala: {roomId}</p>

        {/* Botão de Mutar/Desmutar */}
        <button
          onClick={toggleMute}
          className={`px-4 py-2 rounded-lg ${
            isMuted ? 'bg-red-600' : 'bg-green-600'
          } hover:bg-opacity-80`}
        >
          <FontAwesomeIcon
            icon={isMuted ? faMicrophoneSlash : faMicrophone}
            className="text-2xl"
          />{' '}
          {isMuted ? 'Unmute Me' : 'Mute Me'}
        </button>

        {/* Levantar/Abaixar a Mão */}
        <div className="flex items-center gap-2">
          <FontAwesomeIcon
            icon={isHandRaised ? faHandPaper : faHandRock}
            className={`text-4xl ${
              isHandRaised ? 'text-yellow-400' : 'text-gray-400'
            }`}
          />
          <button
            onClick={toggleRaiseHand}
            className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700"
          >
            {isHandRaised ? 'Lower Hand' : 'Raise Hand'}
          </button>
        </div>

        {/* Compartilhar Tela */}
        <button
          onClick={startScreenShare}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela'}
        </button>

        {/* Área de chat */}
        <div className="flex-1 flex flex-col justify-between mt-4">
          <div className="h-full overflow-y-auto mb-4 bg-gray-700 p-2 rounded">
            {messages.map((msg, index) => (
              <div key={index} className="mb-2">
                <span className="font-bold">{msg.username}:</span> {msg.message}
              </div>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              className="flex-1 p-2 rounded-l-lg text-black"
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendMessage();
                }
              }}
            />
            <button
              onClick={sendMessage}
              className="px-4 bg-green-600 rounded-r-lg hover:bg-green-700"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-3/4 h-full flex flex-col items-center justify-center p-4 gap-4">
        <div className="flex flex-row gap-4 w-full justify-center items-center">
          <video
            autoPlay
            playsInline
            className="rounded-lg w-1/2 bg-gray-800"
            ref={localVideoRef}
            muted
          ></video>
          <div className="flex flex-col items-center w-full gap-4">
            <video
              autoPlay
              playsInline
              className="rounded-lg w-full bg-gray-800"
              ref={remoteVideoRef}
              muted={isRemoteMuted}
            ></video>
            <FontAwesomeIcon
              icon={remoteRaiseHand ? faHandPaper : faHandRock}
              className={`text-4xl ${
                remoteRaiseHand ? 'text-yellow-400' : 'text-gray-400'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
