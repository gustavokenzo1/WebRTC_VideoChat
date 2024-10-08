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

  const [isScreenSharing, setIsScreenSharing] = useState(false);

  let screenTrack: MediaStreamTrack | null = null;

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
      remoteStream = new MediaStream();

      peerConnection.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream?.addTrack(track);
        });
      };

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    }

    const connect = async () => {
      try {
        ws.current = await connectWebSocket('wss://server-misty-pond-1192.fly.dev/');
  
        ws.current.send(
          JSON.stringify({
            type: 'join',
            username,
            roomId,
          })
        );

        ws.current.onmessage = async (message) => {
          const data = JSON.parse(message.data);

          if (data.type === 'offer' && mode === 'remote') {
            await handleReceiveOffer({
              type: 'offer',
              sdp: data.sdp,
            });
          }
          if (peerConnection && peerConnection.current) {
            if (data.type === 'answer' && mode === 'local') {
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
            }

            if (data.type === 'ice-candidate') {
              const candidate = new RTCIceCandidate({
                candidate: data.candidate.candidate,
                sdpMid: data.candidate.sdpMid,
                sdpMLineIndex: data.candidate.sdpMLineIndex,
              });
              await peerConnection.current.addIceCandidate(candidate);
            }
          }

          if (data.type === 'raise-hand') {
            if (data.username !== username) {
              setRemoteRaiseHand(data.handRaised);
            }
          }

          if (data.type === 'mute-user') {
            if (data.username !== username) {
              muteRemoteAudio(data.muted);
            }
          }

          if (data.type === 'chat-message') {
            setMessages((prevMessages) => [
              ...prevMessages,
              { username: data.username, message: data.message },
            ]);
          }
        };

        if (mode === 'local') {
          await handleCreateOffer();
        }
      } catch (error) {}
    };

    connect();
  }, [username, roomId, mode]);

  async function handleCreateOffer() {
    if (peerConnection.current) {
      try {
        await getUserLocalMedia();

        const offerDescription = await peerConnection.current.createOffer();

        await peerConnection.current.setLocalDescription(offerDescription);

        ws.current?.send(
          JSON.stringify({
            type: 'offer',
            roomId,
            sdp: offerDescription.sdp,
          })
        );
      } catch (error) {}
    }
  }

  async function handleReceiveOffer(offer: RTCSessionDescriptionInit) {
    if (peerConnection.current) {
      try {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
      } catch (error) {
        return;
      }
      await getUserLocalMedia();

      if (peerConnection.current.signalingState === 'have-remote-offer') {
        try {
          const answerDescription = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answerDescription);

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
        } catch (error) {}
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
      setMessages((prevMessages) => [
        ...prevMessages,
        { username, message: newMessage },
      ]);
      setNewMessage('');
    }
  };

  return (
    <div className="w-screen h-screen bg-cyan-900 flex text-white">
      <div className="w-1/4 h-full flex flex-col p-4 gap-4 bg-gray-800">
        <p>ID da sala: {roomId}</p>
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
          {isMuted ? 'Desmutar' : 'Mutar'}
        </button>
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
            {isHandRaised ? 'Abaixar a mão' : 'Levantar a mão'}
          </button>
        </div>
        <button
          onClick={startScreenShare}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela'}
        </button>
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
