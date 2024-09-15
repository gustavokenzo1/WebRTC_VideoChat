import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVolumeMute, faVolumeUp } from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [volume, setVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      });
  }, []);

  const toggleMute = async () => {
    setIsMuted((prevState) => !prevState);

    if (isMuted) {
      // Ativar o microfone e iniciar a captura de áudio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      source.connect(analyserRef.current);

      const updateVolume = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const maxVolume = Math.max(...dataArray);

        // Atenuação do volume quando não há som (menor que 5)
        setVolume(maxVolume > 5 ? maxVolume : 0);

        animationIdRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } else {
      // Desativar o microfone
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      setVolume(0); // Resetar o volume quando mutado
    }
  };

  function handleJoinRoom() {
    if (!username) {
      setErrorMessage("Por favor, insira um nome de usuário.");
      return;
    }
    if (!roomId) {
      setErrorMessage("Por favor, insira o ID da sala.");
      return;
    }
    setErrorMessage(null);
    setMode("remote");
    setIsHomeScreen(false);
  }

  function handleCreateRoom() {
    if (!username) {
      setErrorMessage("Por favor, insira um nome de usuário.");
      return;
    }
    const id = uuidv4();
    setRoomId(id);
    setErrorMessage(null);
    setMode("local");
    setIsHomeScreen(false);
  }

  return (
    <motion.div
      className="w-full max-w-lg bg-cyan-800 p-6 rounded-lg flex flex-col items-center justify-center shadow-xl text-white"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
    >
      <h1 className="font-bold text-4xl mb-6 text-center">Video Call Room</h1>

      <motion.video
        autoPlay
        playsInline
        className="rounded-lg mt-4 shadow-lg w-full"
        ref={localVideoRef}
        muted={isMuted}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      ></motion.video>

      <motion.button
        className="bg-blue-500 p-3 rounded-lg mt-6 flex items-center justify-center gap-2 shadow-md hover:bg-blue-600 transition-all duration-300 transform hover:scale-105"
        type="button"
        onClick={toggleMute}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <FontAwesomeIcon
          icon={isMuted ? faVolumeMute : faVolumeUp}
          size="lg"
        />
        {isMuted ? "Testar áudio" : "Desativar teste de áudio"}
      </motion.button>

      {/* Barra de visualização do volume - só aparece quando o áudio é testado */}
      {!isMuted && (
        <div className="w-full mt-6 flex items-center justify-center">
          <div
            className="w-full h-6 rounded-md transition-all"
            style={{
              backgroundColor: volume > 100 ? "#ff4d4d" : "#4caf50",
              width: `${Math.min(volume, 100)}%`, // A largura aumenta conforme o volume
            }}
          ></div>
        </div>
      )}

      <div className="w-full mt-8">
        <h1 className="text-lg">Nome de usuário</h1>
        <motion.input
          type="text"
          className="w-full bg-cyan-700 p-3 rounded-md mt-2 text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-md"
          placeholder="Nome de usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        />
      </div>

      <span className="h-[2px] w-full bg-cyan-700 mt-4" />

      <div className="w-full flex flex-col sm:flex-row justify-between gap-6 mt-4 items-center">
        <div className="w-full sm:w-1/2">
          <h1 className="text-lg">Entrar em uma reunião</h1>
          <motion.input
            type="text"
            className="w-full bg-cyan-700 p-3 rounded-md mt-2 text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-md"
            placeholder="ID da sala"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          />
          <motion.button
            className="bg-blue-500 p-3 rounded-md mt-4 hover:bg-blue-600 transition-all w-full shadow-md transform hover:scale-105"
            type="button"
            onClick={handleJoinRoom}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Entrar
          </motion.button>
        </div>
        <p className="text-white">ou</p>
        <div className="w-full sm:w-1/2">
          <motion.button
            className="bg-green-500 p-3 rounded-md mt-4 hover:bg-green-600 transition-all w-full shadow-md transform hover:scale-105"
            type="button"
            onClick={handleCreateRoom}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Criar uma nova reunião
          </motion.button>
        </div>
      </div>

      {errorMessage && (
        <motion.div
          className="bg-red-500 text-white p-3 rounded-md mt-4 w-full text-center shadow-md"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {errorMessage}
        </motion.div>
      )}
    </motion.div>
  );
}
