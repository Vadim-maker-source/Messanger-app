import { logout } from '@/lib/auth';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';

const LogoutButton: React.FC = () => {
  const router = useRouter();

  const handleLogout = async (): Promise<void> => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти из аккаунта?',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Перенаправляем на страницу входа
              router.replace('/sign-in');
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось выйти из системы');
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      className="bg-red-500 px-4 py-2 rounded-lg"
    >
      <Text className="text-white font-semibold">Выйти</Text>
    </TouchableOpacity>
  );
};

export default LogoutButton;