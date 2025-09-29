import { getCurrentUser, login } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

const SignIn: React.FC = () => {
  const navigation = useRouter();
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          router.replace('/');
        }
      } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleSignIn = async () => {
    if (!password) {
      Alert.alert('Ошибка', 'Введите пароль');
      return;
    }

    if (loginMethod === 'email' && !email) {
      Alert.alert('Ошибка', 'Введите email');
      return;
    }

    if (loginMethod === 'phone' && !phoneNumber) {
      Alert.alert('Ошибка', 'Введите номер телефона');
      return;
    }

    setLoading(true);
    try {
      let data;
      if (loginMethod === 'email') {
        data = await login({ email, password });
      } else {
        data = await login({ number: phoneNumber, password });
      }
      
      await AsyncStorage.setItem('userToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      
      Alert.alert('Успех', 'Вход выполнен!');
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Ошибка', error.response?.data?.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white mt-10">
      <Text className="text-2xl font-bold text-center mb-8">Вход</Text>
      
      {/* Переключатель метода входа */}
      <View className="flex-row mb-6 bg-gray-100 p-1 rounded-lg">
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg ${loginMethod === 'email' ? 'bg-white shadow' : ''}`}
          onPress={() => setLoginMethod('email')}
        >
          <Text className={`text-center ${loginMethod === 'email' ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
            Email
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg ${loginMethod === 'phone' ? 'bg-white shadow' : ''}`}
          onPress={() => setLoginMethod('phone')}
        >
          <Text className={`text-center ${loginMethod === 'phone' ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
            Телефон
          </Text>
        </TouchableOpacity>
      </View>

      {loginMethod === 'email' ? (
        <TextInput
          className="h-12 border border-gray-300 rounded-lg px-4 mb-4"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
      ) : (
        <TextInput
          className="h-12 border border-gray-300 rounded-lg px-4 mb-4"
          placeholder="Номер телефона"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
      )}
      
      <TextInput
        className="h-12 border border-gray-300 rounded-lg px-4 mb-6"
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity
        className={`h-12 bg-blue-500 rounded-lg justify-center items-center mb-6 ${loading ? 'opacity-50' : ''}`}
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? 'Вход...' : 'Войти'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
        <Text className="text-blue-500 text-center">Нет аккаунта? Зарегистрироваться</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignIn;