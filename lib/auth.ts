import AsyncStorage from '@react-native-async-storage/async-storage';

export const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('userToken');
  } catch (error) {
    console.error('Ошибка получения токена:', error);
    return null;
  }
};

export const setToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('userToken', token);
  } catch (error) {
    console.error('Ошибка сохранения токена:', error);
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('userToken');
  } catch (error) {
    console.error('Ошибка удаления токена:', error);
  }
};

export const getUser = async (): Promise<any | null> => {
  try {
    const user = await AsyncStorage.getItem('userData');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return null;
  }
};

export const setUser = async (user: any): Promise<void> => {
  try {
    await AsyncStorage.setItem('userData', JSON.stringify(user));
  } catch (error) {
    console.error('Ошибка сохранения пользователя:', error);
  }
};

export const removeUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('userData');
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
  }
};

// Основная функция выхода
export const logout = async (): Promise<void> => {
  try {
    await Promise.all([
      removeToken(),
      removeUser()
    ]);
    console.log('Успешный выход из системы');
  } catch (error) {
    console.error('Ошибка при выходе:', error);
    throw new Error('Не удалось выйти из системы');
  }
};