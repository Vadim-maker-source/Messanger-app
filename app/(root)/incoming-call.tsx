import { acceptCall, rejectCall } from '@/lib/api';
import { Call } from '@/lib/types';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, Vibration, View } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

export default function IncomingCallScreen() {
  const router = useRouter();
  const { call } = useLocalSearchParams();
  const [callData, setCallData] = useState<Call | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    if (call) {
      const parsedCall = JSON.parse(call as string);
      
      // Проверяем, не обработан ли уже этот звонок
      if (parsedCall.status !== 'calling') {
        router.back();
        return;
      }
      
      setCallData(parsedCall);
      playRingtone();
      startVibration();
    }
  
    return () => {
      stopRingtone();
      stopVibration();
    };
  }, [call]);

  const playRingtone = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/ringtone.mp3'),
        { shouldPlay: true, isLooping: true }
      );
      setSound(sound);
    } catch (error) {
      console.error('Ошибка воспроизведения звонка:', error);
    }
  };

  const stopRingtone = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };

  const startVibration = () => {
    Vibration.vibrate([500, 500], true); // Вибрация: вибрировать 500ms, пауза 500ms, повторять
  };

  const stopVibration = () => {
    Vibration.cancel();
  };

  const handleAccept = async () => {
    if (!callData) return;
    
    try {
      stopRingtone();
      stopVibration();
      
      await acceptCall(callData.id);
      router.replace({
        pathname: '/active-call',
        params: { 
          call: JSON.stringify({ ...callData, status: 'accepted' }),
          isReceiver: 'true'
        }
      });
    } catch (error: any) {
      console.error('Ошибка принятия звонка:', error);
      router.back();
    }
  };

  const handleReject = async () => {
    if (!callData) return;
    
    try {
      stopRingtone();
      stopVibration();
      
      await rejectCall(callData.id);
      router.back();
    } catch (error: any) {
      console.error('Ошибка отклонения звонка:', error);
      router.back();
    }
  };

  if (!callData) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <Text className="text-white text-lg">Звонок не найден</Text>
      </View>
    );
  }

  const isVideoCall = callData.callType === 'video';

  return (
    <View className="flex-1 bg-gray-900 justify-center items-center">
      {/* Фон с размытием */}
      <View className="absolute inset-0 bg-black opacity-70" />
      
      {/* Информация о звонке */}
      <View className="items-center z-10">
        <Text className="text-white text-2xl mb-2">
          {isVideoCall ? 'Входящий видеозвонок' : 'Входящий звонок'}
        </Text>
        
        {/* <Image
          source={{ uri: callData.caller.avatar || 'https://via.placeholder.com/150' }}
          className="w-32 h-32 rounded-full mb-4 border-4 border-white"
        />
        
        <Text className="text-white text-3xl font-bold mb-1">
          {callData.caller.name}
        </Text>
        
        <Text className="text-gray-300 text-lg">
          {callData.caller.number || 'Номер не указан'}
        </Text> */}
      </View>

      {/* Кнопки действий */}
      <View className="absolute bottom-20 w-full px-10">
        <View className="flex-row justify-between">
          {/* Кнопка отклонения */}
          <TouchableOpacity
            onPress={handleReject}
            className="bg-red-500 w-20 h-20 rounded-full items-center justify-center"
          >
            <FontAwesome name="phone" size={30} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>

          {/* Кнопка принятия */}
          <TouchableOpacity
            onPress={handleAccept}
            className="bg-green-500 w-20 h-20 rounded-full items-center justify-center"
          >
            <FontAwesome name="phone" size={30} color="white" />
          </TouchableOpacity>
        </View>
        
        <View className="flex-row justify-between mt-4">
          <Text className="text-red-400 text-center flex-1">Отклонить</Text>
          <Text className="text-green-400 text-center flex-1">Принять</Text>
        </View>
      </View>
    </View>
  );
}