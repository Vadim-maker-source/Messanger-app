import { getCurrentUser, register } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import PhoneInput from 'react-native-phone-input';

const SignUp: React.FC = () => {
  const navigation = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Ссылка на компонент PhoneInput для доступа к его методам
  const phoneInputRef = useRef<PhoneInput>(null);

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

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }

    // Получаем номер телефона из компонента PhoneInput
    const phoneNumber = phoneInputRef.current?.getValue() || '';
    if (!phoneNumber) {
      Alert.alert('Ошибка', 'Введите номер телефона');
      return;
    }

    setLoading(true);
    try {
      const data = await register({ name, email, password, number: phoneNumber });
      
      await AsyncStorage.setItem('userToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      
      Alert.alert('Успех', 'Регистрация прошла успешно!');
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Ошибка', error.response?.data?.error || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white mt-6">
      <Text className="text-2xl font-bold text-center mb-8">Регистрация</Text>
      
      <TextInput
        className="h-12 border border-gray-300 rounded-lg px-4 mb-4"
        placeholder="Имя"
        value={name}
        onChangeText={setName}
      />
      
      <TextInput
        className="h-12 border border-gray-300 rounded-lg px-4 mb-4"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      
      <TextInput
        className="h-12 border border-gray-300 rounded-lg px-4 mb-4"
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      {/* Компонент ввода телефона */}
      <View className="mb-6">
        <Text className="text-gray-700 text-sm mb-2">Номер телефона</Text>
        <PhoneInput
          ref={phoneInputRef}
          initialCountry="ru"
          style={{
            height: 48,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 8,
            paddingHorizontal: 16,
            backgroundColor: 'white',
          }}
          textStyle={{
            fontSize: 16,
            color: '#1f2937',
          }}
        />
      </View>
      
      <TouchableOpacity
        className={`h-12 bg-blue-500 rounded-lg justify-center items-center mb-6 ${loading ? 'opacity-50' : ''}`}
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
        <Text className="text-blue-500 text-center">Уже есть аккаунт? Войти</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignUp;