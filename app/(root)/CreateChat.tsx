import { addGroupMember, createGroup, searchUsers } from '@/lib/api';
import { User } from '@/lib/types';
import { useRouter } from 'expo-router';
import debounce from 'lodash.debounce';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

const CreateChat = () => {
  const router = useRouter();
  const [chatName, setChatName] = useState('');
  const [chatUsername, setChatUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const results = await searchUsers(query);
        setSearchResults(results);
      } catch (error: any) {
        Alert.alert('Ошибка', error.message || 'Ошибка поиска');
      } finally {
        setSearching(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const toggleUserSelection = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, { id: user.id, name: user.name, avatar: user.avatar, email: user.email }];
      }
    });
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Ошибка', 'Выберите хотя бы одного участника');
      return;
    }

    const finalName =
      chatName.trim() ||
      (selectedUsers.length === 1
        ? `Чат с ${selectedUsers[0].name}`
        : `Группа (${selectedUsers.length + 1} участников)`);

    setLoading(true);
    try {
      const chat = await createGroup({
        name: finalName,
        username: chatUsername.trim() ? chatUsername.trim().replace(/^@/, '') : undefined,
        isChat: true,
        adminIds: [],
      });

      for (const user of selectedUsers) {
        try {
          await addGroupMember(chat.id, user.id);
        } catch (err) {
          console.warn(`Не удалось добавить ${user.id}:`, err);
        }
      }

      Alert.alert('Успех', `Чат "${chat.name}" создан!`);
      router.back();
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Ошибка создания чата');
    } finally {
      setLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.some(u => u.id === item.id);

    return (
      <View className="mb-2">
        <TouchableOpacity
          onPress={() => toggleUserSelection(item)}
          className={`flex-row items-center p-4 rounded-lg ${isSelected ? 'bg-[#4ECDC4]' : 'bg-gray-700'}`}
        >
          <View className="w-10 h-10 rounded-full bg-gray-500 justify-center items-center mr-3">
            {item.avatar ? (
              <Text>🖼️</Text>
            ) : (
              <Text className="text-white font-bold">
                {item.name[0]?.toUpperCase()}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className={`font-medium ${isSelected ? 'text-white' : 'text-gray-200'}`}>
              {item.name}
            </Text>
            <Text className={`text-xs ${isSelected ? 'text-white' : 'text-gray-400'}`}>
              {item.email}
            </Text>
          </View>
          {isSelected && (
            <View className="w-5 h-5 rounded-full bg-white justify-center items-center">
              <Text className="text-[#4ECDC4] text-xs">✓</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#344d67] p-5">
      <Text className="text-white text-xl font-bold mb-5">Создать чат</Text>

      <TextInput
        placeholder="Название чата (опционально)"
        placeholderTextColor="#aaa"
        value={chatName}
        onChangeText={setChatName}
        className="w-full p-4 bg-gray-700 text-white rounded-lg mb-4"
      />

      <TextInput
        placeholder="@username (опционально)"
        placeholderTextColor="#aaa"
        value={chatUsername}
        onChangeText={setChatUsername}
        className="w-full p-4 bg-gray-700 text-white rounded-lg mb-4"
      />

      <Text className="text-white font-semibold mb-2">Добавить участников</Text>
      <View className="relative mb-4">
        <TextInput
          placeholder="Поиск по имени или email..."
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="w-full p-4 pl-12 bg-gray-700 text-white rounded-lg"
        />
        <FontAwesome
          name="search"
          size={18}
          color="#aaa"
          style={{ position: 'absolute', left: 14, top: 14 }}
        />
        {searching && (
          <ActivityIndicator
            size="small"
            color="#4ECDC4"
            style={{ position: 'absolute', right: 14, top: 14 }}
          />
        )}
      </View>

      {searchQuery.length >= 2 && (
        <View className="mb-4">
          <Text className="text-gray-300 text-sm mb-2">
            {searchResults.length > 0
              ? `Найдено ${searchResults.length}:`
              : 'Пользователи не найдены'}
          </Text>
          <FlatList
            data={searchResults}
            keyExtractor={item => item.id.toString()}
            renderItem={renderUserItem}
            nestedScrollEnabled
            style={{ maxHeight: 300 }}
            className="rounded-lg"
          />
        </View>
      )}

      {selectedUsers.length > 0 && (
        <View className="mb-4">
          <Text className="text-white font-semibold mb-2">Участники ({selectedUsers.length})</Text>
          <View className="flex-row flex-wrap gap-2">
            {selectedUsers.map(user => (
              <View
                key={user.id}
                className="rounded-full px-3 py-1 flex-row items-center bg-[#4ECDC4]"
              >
                <Text className="text-white text-sm mr-1">{user.name}</Text>
                <TouchableOpacity onPress={() => toggleUserSelection(user)}>
                  <Text className="text-white">✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={handleCreate}
        disabled={loading || selectedUsers.length === 0}
        className={`p-4 rounded-lg ${loading || selectedUsers.length === 0 ? 'bg-gray-600' : 'bg-[#4ECDC4]'}`}
      >
        <Text className="text-center text-white font-semibold">
          {loading
            ? 'Создание...'
            : selectedUsers.length > 1
            ? 'Создать групповой чат'
            : 'Создать чат'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default CreateChat;
