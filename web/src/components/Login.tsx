import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeMute, faVolumeUp } from '@fortawesome/free-solid-svg-icons';

interface LoginProps {
  setIsHomeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  username: string;
  setUsername: React.Dispatch<React.SetStateAction<string>>;
  roomId: string;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  setMode: React.Dispatch<React.SetStateAction<string>>;
}

export default function Login({
  setIsHomeScreen,
  username,
  setUsername,
  roomId,
  setRoomId,
  setMode,
}: LoginProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Estado para mensagem de erro

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      });
  }, []);

  const toggleMute = () => {
    setIsMuted((prevState) => !prevState);
  };

  function handleJoinRoom() {
    if (!username) {
      setErrorMessage('Por favor, insira um nome de usuário.');
      return;
    }
    // Sucesso - Limpa a mensagem de erro e segue para a sala
    setErrorMessage(null);
    setMode('remote');
    setIsHomeScreen(false);
  }

  function handleCreateRoom() {
    if (!username) {
      setErrorMessage('Por favor, insira um nome de usuário.');
      return;
    }
    const id = uuidv4();
    setRoomId(id);
    setErrorMessage(null);
    setMode('local');
    setIsHomeScreen(false);
  }

  return (
    <div className="w-3/4 bg-cyan-800 p-4 rounded-lg flex flex-col items-center justify-center">
      <h1 className="font-bold text-2xl">Chat de vídeo WebRTC</h1>
      <video
        autoPlay
        playsInline
        className="rounded-lg mt-4"
        ref={localVideoRef}
        muted={isMuted}
      ></video>
      <button
        className="bg-cyan-700 p-2 rounded-md mt-4 hover:bg-cyan-900 transition-colors flex items-center gap-2"
        type="button"
        onClick={toggleMute}
      >
        <FontAwesomeIcon icon={isMuted ? faVolumeMute : faVolumeUp} size="lg" />
        {isMuted ? 'Testar áudio' : 'Desativar teste de áudio'}
      </button>
      
      <div className="w-1/2 mt-4">
        <h1>Nome de usuário</h1>
        <input
          type="text"
          className="w-full bg-cyan-700 p-2 rounded-md mt-2"
          placeholder="Nome de usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <span className="h-[2px] w-full bg-cyan-700 mt-4" />

      <div className="w-full flex flex-row justify-between gap-6 mt-4 items-center">
        <div className="w-1/2">
          <h1>Entrar em uma reunião</h1>
          <input
            type="text"
            className="w-full bg-cyan-700 p-2 rounded-md mt-2"
            placeholder="ID da sala"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button
            className="bg-cyan-700 p-2 rounded-md mt-4 hover:bg-cyan-900 transition-colors w-full"
            type="button"
            onClick={handleJoinRoom}
          >
            Entrar
          </button>
        </div>
        <p>ou</p>
        <div className="w-1/2">
          <button
            className="bg-cyan-700 p-2 rounded-md mt-4 hover:bg-cyan-900 transition-colors w-full"
            type="button"
            onClick={handleCreateRoom}
          >
            Criar uma nova reunião
          </button>
        </div>
      </div>

      {/* Exibe a mensagem de erro, se existir */}
      {errorMessage && (
        <div className="bg-red-500 text-white p-2 rounded-md mt-4 w-full text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
