import { useState } from 'react';
import Login from './components/Login';
import Meet from './components/Meet';

export default function App() {
  const [isHomeScreen, setIsHomeScreen] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');

  return (
    <div className="w-screen h-screen bg-cyan-900 flex flex-col items-center justify-center text-white">
      {isHomeScreen ? (
        <Login
          setIsHomeScreen={setIsHomeScreen}
          username={username}
          setUsername={setUsername}
          roomId={roomId}
          setRoomId={setRoomId}
        />
      ) : (
        <Meet username={username} roomId={roomId} />
      )}
    </div>
  );
}
