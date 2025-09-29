import { addContact, getUserProfile, initiateCall, removeContact, updateContact } from '@/lib/api';
import { User } from '@/lib/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

interface ProfileProps {
  user: User
  commonGroups: any[];
  isContact: boolean;
}

const Profile = () => {
  const { id } = useLocalSearchParams();
  const userId = parseInt(id as string);
  const router = useRouter();
  
  const [profile, setProfile] = useState<ProfileProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile(); // Перезагружаем профиль при фокусе
      return () => {};
    }, [userId])
  );

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserProfile(userId);
      setProfile(data);
      setCustomName(data.user.customName || data.user.name);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!customName.trim()) {
      Alert.alert('Ошибка', 'Введите имя контакта');
      return;
    }
    
    try {
      await addContact(userId, customName.trim());
      Alert.alert('Успех', 'Контакт добавлен');
      loadProfile(); // Обновляем профиль
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const handleUpdateContact = async () => {
    if (!customName.trim()) {
      Alert.alert('Ошибка', 'Введите имя контакта');
      return;
    }
    
    try {
      await updateContact(userId, customName.trim());
      Alert.alert('Успех', 'Имя контакта изменено');
      setIsEditingName(false);
      loadProfile(); // Обновляем профиль
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const handleRemoveContact = async () => {
    Alert.alert(
      'Удалить контакт',
      'Вы уверены, что хотите удалить этот контакт?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeContact(userId);
              Alert.alert('Успех', 'Контакт удален');
              loadProfile();
            } catch (error: any) {
              Alert.alert('Ошибка', error.message);
            }
          }
        }
      ]
    );
  };

  const handleCall = async (type: 'audio' | 'video') => {
    try {
      const result = await initiateCall(userId, type);
      
      router.push({
        pathname: '/active-call',
        params: { 
          call: JSON.stringify(result.call),
          isReceiver: 'false'
        }
      });
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const renderChatItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      className="flex-row items-center p-3 border-b border-gray-200"
      onPress={() => {
        router.push({
          pathname: '/chat/[id]',
          params: { 
            id: item.id.toString(), 
            isChat: String(item.isChat)
          }
        });
      }}
    >
      <View className="w-12 h-12 rounded-full bg-blue-500 items-center justify-center mr-3">
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} className="w-12 h-12 rounded-full" />
        ) : (
          <Text className="text-white font-bold text-lg">
            {item.name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-gray-800">{item.name}</Text>
        <Text className="text-sm text-gray-500">
          {item.isPrivate ? 'Приватный чат' : item.isChat ? 'Группа' : 'Канал'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">Профиль не найден</Text>
      </View>
    );
  }

  const displayName = profile.user.customName || profile.user.name;

  return (
    <View className="flex-1">
      {/* Шапка */}
      <View className="p-6 border-b border-gray-200">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="absolute top-6 left-6"
        >
          <FontAwesome name="arrow-left" size={20} color="#000" />
        </TouchableOpacity>
        
        <View className="items-center">
          <View className="w-24 h-24 rounded-full bg-blue-500 items-center justify-center mb-4">
            {profile.user.avatar ? (
              <Image source={{ uri: profile.user.avatar }} className="w-24 h-24 rounded-full" />
            ) : (
              <Text className="text-white font-bold text-3xl">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          
          {isEditingName ? (
    <View className="flex-row items-center justify-center gap-2 mb-2">
      <TextInput
        className="border border-gray-300 rounded px-3 py-1 flex-1"
        value={customName}
        onChangeText={setCustomName}
        placeholder="Имя контакта"
        autoFocus
      />
      <TouchableOpacity 
        onPress={handleUpdateContact}
        className="bg-green-500 px-3 py-1 rounded"
      >
        <FontAwesome name="check" size={16} color="white" />
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={() => {
          setIsEditingName(false);
          setCustomName(profile.user.customName || profile.user.name);
        }}
        className="bg-gray-300 px-3 py-1 rounded"
      >
        <FontAwesome name="times" size={16} color="gray" />
      </TouchableOpacity>
    </View>
  ) : (
            <Text className="text-2xl font-bold text-white mb-1">
              {displayName}
            </Text>
          )}
          
          {profile.user.number && (
            <Text className="text-gray-300">{profile.user.number}</Text>
          )}
        </View>
      </View>

      {/* Действия */}
      <View className="p-6">
        <View className="flex-row justify-between w-full gap-3 mb-6">
          <TouchableOpacity 
            className="bg-green-500 px-6 py-3 flex-1 flex-row rounded-lg items-center justify-center gap-2"
            onPress={() => handleCall('audio')}
          >
            <FontAwesome name="phone" size={20} color="white" />
            <Text className="text-white text-sm">Аудио</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-blue-500 px-6 py-3 flex-1 flex-row rounded-lg items-center justify-center gap-2"
            onPress={() => handleCall('video')}
          >
            <FontAwesome name="video-camera" size={20} color="white" />
            <Text className="text-white text-sm">Видео</Text>
          </TouchableOpacity>
        </View>

        {/* Кнопка контакта */}
        {profile.isContact ? (
          <View className="flex-row gap-3">
            <TouchableOpacity 
              className="flex-1 bg-gray-200 py-3 rounded-lg items-center"
              onPress={() => setIsEditingName(true)}
            >
              <Text className="text-gray-700 font-medium">Изменить имя</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="flex-1 bg-red-500 py-3 rounded-lg items-center"
              onPress={handleRemoveContact}
            >
              <Text className="text-white font-medium">Удалить</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            className="bg-blue-500 py-3 rounded-lg items-center"
            onPress={handleAddContact}
          >
            <Text className="text-white font-medium">Добавить в контакты</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Совместные чаты */}
      <View className="px-6 mb-4">
        <Text className="text-lg font-semibold text-gray-800 mb-3">
          Совместные чаты ({profile.commonGroups.length})
        </Text>
        
        {profile.commonGroups.length === 0 ? (
          <Text className="text-gray-500 text-center py-4">
            Нет совместных чатов
          </Text>
        ) : (
          <FlatList
            data={profile.commonGroups}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderChatItem}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

export default Profile;