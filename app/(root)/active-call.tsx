// src/app/active-call.tsx
import { useCall } from '@/context/call-context';
import { endCall } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import InCallManager from 'react-native-incall-manager';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { mediaDevices, MediaStream, RTCView } from 'react-native-webrtc';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ActiveCall() {
  const { call, isReceiver } = useLocalSearchParams();
  const router = useRouter();
  const callData = JSON.parse(call as string);
  const [status, setStatus] = useState<'active' | 'ended'>('active');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');

  const localStreamRef = useRef<MediaStream | null>(null);
  const { incomingCall, hideIncomingCall } = useCall();

  // Запрос разрешений (Android)
  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Видеозвонки недоступны в веб-версии</Text>
        </View>
      );
    }
    if (Platform.OS === 'android') {
      const audio = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  const camera = callData.callType === 'video'
    ? await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
    : 'granted';

      if (audio !== 'granted' || camera !== 'granted') {
        Alert.alert('Разрешения отклонены', 'Без разрешений звонок невозможен');
        handleEndCall();
        return false;
      }
    }
    return true;
  };

  // Получение локального потока
  const getLocalStream = async () => {
    const hasPerms = await requestPermissions();
    if (!hasPerms) return;

    try {
      const constraints = {
        audio: true,
        video: callData.callType === 'video'
          ? { facingMode: cameraFacing === 'front' ? 'user' : 'environment' }
          : false,
      };

      const stream = await mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Изначально включаем динамик для видео, отключаем для аудио
      if (callData.callType === 'video') {
        await InCallManager.setSpeakerphoneOn(true);
        setSpeakerEnabled(true);
      } else {
        await InCallManager.setSpeakerphoneOn(false);
        setSpeakerEnabled(false);
      }

      // Микрофон включён по умолчанию
      stream.getAudioTracks().forEach(track => (track.enabled = true));
    } catch (err: any) {
      console.error('Ошибка получения медиапотока:', err);
      Alert.alert('Ошибка', 'Не удалось получить доступ к микрофону/камере');
      handleEndCall();
    }
  };

  const handleEndCall = async () => {
    if (status === 'ended') return;
    setStatus('ended');

    // Освобождаем ресурсы
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setRemoteStream(null);

    try {
      await endCall(callData.id);
    } catch (err: any) {
      console.warn('Ошибка при завершении звонка:', err.message);
    } finally {
      router.back();
    }
  };

  // Обработка WebSocket-событий (если звонок завершил другой участник)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background') {
        // Можно приглушить звук или предупредить, но не завершать автоматически
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  // Запуск потока при монтировании
  useEffect(() => {
    getLocalStream();

    // Здесь можно инициировать WebRTC-соединение (signaling через WebSocket)
    // Но для упрощения предположим, что вы уже обмениваетесь SDP через WS

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Переключение микрофона
  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !micEnabled;
      setMicEnabled(!micEnabled);
    }
  };

  // Переключение динамика
  const toggleSpeaker = async () => {
    const newState = !speakerEnabled;
    await InCallManager.setSpeakerphoneOn(newState);
    setSpeakerEnabled(newState);
  };

  // Переключение камеры (только видео)
  const switchCamera = async () => {
    if (callData.callType !== 'video' || !localStream) return;

    const newFacing = cameraFacing === 'front' ? 'back' : 'front';
    setCameraFacing(newFacing);

    // Остановить текущий видеопоток
    localStream.getVideoTracks().forEach(track => track.stop());

    try {
      const newStream = await mediaDevices.getUserMedia({
        audio: false, // микрофон уже есть в localStream
        video: { facingMode: newFacing === 'front' ? 'user' : 'environment' },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      localStream.addTrack(newVideoTrack);

      // Обновляем состояние
      setLocalStream(new MediaStream([...localStream.getAudioTracks(), newVideoTrack]));
      localStreamRef.current = new MediaStream([...localStream.getAudioTracks(), newVideoTrack]);
    } catch (err) {
      console.error('Ошибка переключения камеры:', err);
    }
  };

  if (status === 'ended') {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <Text className="text-xl">Звонок завершён</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Видео удалённого участника (заглушка — в реальности нужно получать через WebRTC) */}
      {callData.callType === 'video' && (
        <View className="flex-1">
          {/* В реальном приложении здесь будет remoteStream */}
          <View className="flex-1 bg-gray-900 justify-center items-center">
            <Text className="text-white">Видеопоток собеседника</Text>
            {/* <RTCView
              streamURL={remoteStream?.toURL()}
              objectFit="cover"
              style={{ width: '100%', height: '100%' }}
            /> */}
          </View>
        </View>
      )}

      {/* Локальное видео (мини-окно) */}
      {callData.callType === 'video' && localStream && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            right: 20,
            width: 120,
            height: 160,
            backgroundColor: 'black',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <RTCView
            streamURL={localStream.toURL()}
            objectFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      )}

      {/* Информация о звонке */}
      <View className="absolute top-20 left-0 right-0 items-center">
        <Text className="text-white text-2xl">
          {isReceiver === 'true' ? 'Входящий' : 'Исходящий'} {callData.callType} звонок
        </Text>
        <Text className="text-gray-300 mt-1">
          {callData.callerName || 'Пользователь'} • {callData.callType === 'video' ? 'Видео' : 'Аудио'}
        </Text>
      </View>

      {/* Панель управления */}
      <View className="absolute bottom-20 left-0 right-0 flex-row justify-center items-center gap-8">
        {/* Микрофон */}
        <TouchableOpacity
          onPress={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center ${
            micEnabled ? 'bg-red-500' : 'bg-gray-600'
          }`}
        >
          <FontAwesome name={micEnabled ? 'microphone' : 'microphone-slash'} size={20} color="white" />
        </TouchableOpacity>

        {/* Завершить звонок */}
        <TouchableOpacity
          onPress={handleEndCall}
          className="bg-red-600 w-16 h-16 rounded-full items-center justify-center"
        >
          <FontAwesome name="phone" size={24} color="white" />
        </TouchableOpacity>

        {/* Динамик */}
        <TouchableOpacity
          onPress={toggleSpeaker}
          className={`w-14 h-14 rounded-full flex items-center justify-center ${
            speakerEnabled ? 'bg-blue-500' : 'bg-gray-600'
          }`}
        >
          <FontAwesome
            name={speakerEnabled ? 'volume-up' : 'volume-off'}
            size={20}
            color="white"
          />
        </TouchableOpacity>

        {/* Переключение камеры (только видео) */}
        {callData.callType === 'video' && (
          <TouchableOpacity
            onPress={switchCamera}
            className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center"
          >
            <FontAwesome name="rotate-left" size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}