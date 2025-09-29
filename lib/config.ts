import { Platform } from 'react-native';

// Определяем базовый URL в зависимости от платформы и среды
export const getApiUrl = (): string => {
  if (!__DEV__) {
    return String(process.env.EXPO_PUBLIC_API_URL);
  }

  // Для разработки
  if (Platform.OS === 'android') {
    return 'http://192.168.0.104:5000'; // Android эмулятор
  } else if (Platform.OS === 'ios') {
    return 'http://192.168.0.104:5000'; // iOS симулятор
  } else {
    // Для физических устройств - используйте IP вашего компьютера
    return 'http://localhost:5000'; // ЗАМЕНИТЕ НА ВАШ IP!
  }
};

export const getWsUrl = (): string => {
  if (!__DEV__) {
    // Для продакшена — бери из переменной
    const url = process.env.EXPO_PUBLIC_WS_URL || process.env.EXPO_PUBLIC_API_URL;
    return url?.replace('http://', '').replace('https://', '') || 'localhost:5000';
  }

  // Для разработки — ОДИН локальный IP для всех устройств
  return '192.168.0.104:5000'; // ← ЗАМЕНИ НА СВОЙ ЛОКАЛЬНЫЙ IP!
};

export const getWsUrl2 = (): string => {
  if (!__DEV__) {
    return String(process.env.EXPO_PUBLIC_API_URL);
  }

  // Для разработки
  if (Platform.OS === 'android') {
    return '192.168.0.104:5000'; // Android эмулятор
  } else if (Platform.OS === 'ios') {
    return '192.168.0.104:5000'; // iOS симулятор
  } else {
    // Для физических устройств - используйте IP вашего компьютера
    return 'localhost:5000'; // ЗАМЕНИТЕ НА ВАШ IP!
  }
};

export const WS_URL = getWsUrl()

export const API_URL = getApiUrl();

export const BASE_URL = API_URL;