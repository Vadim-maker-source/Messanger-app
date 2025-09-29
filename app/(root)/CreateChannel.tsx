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

const CreateChannel = () => {
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [groupUsername, setGroupUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [adminUsers, setAdminUsers] = useState<Set<number>>(new Set()); // Множество ID админов
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
        // Удаляем из админов, если удаляем из участников
        setAdminUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.id);
          return newSet;
        });
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, { id: user.id, name: user.name, avatar: user.avatar, email: user.email }];
      }
    });
  };

  const toggleAdmin = (userId: number) => {
    setAdminUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Ошибка', 'Введите название группы');
      return;
    }

    setLoading(true);
    try {
      const adminIds = Array.from(adminUsers);

      // Создаем группу с админами (создатель автоматически добавится как админ/участник на сервере)
      const group = await createGroup({
        name: groupName.trim(),
        username: groupUsername.trim() ? groupUsername.trim().replace(/^@/, '') : undefined,
        isChat: false,
        adminIds,
      });

      // Теперь добавим остальных выбранных пользователей как обычных участников (тех, кто НЕ в adminIds и не создатель)
      const selectedIds = selectedUsers.map(u => u.id);
      const nonAdminIds = selectedIds.filter(id => !adminIds.includes(id));

      for (const uid of nonAdminIds) {
        try {
          await addGroupMember(group.id, uid);
        } catch (err) {
          console.warn(`Не удалось добавить участника ${uid}:`, err);
          // не ломаем весь процесс, просто логируем
        }
      }

      Alert.alert(
        'Успех',
        `Канал "${group.name}" создан с ${selectedUsers.length} участниками, из них админы: ${adminIds.length}`
      );
      router.back();
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Ошибка при создании канала');
    } finally {
      setLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.some(u => u.id === item.id);
    const isAdmin = adminUsers.has(item.id);

    return (
      <View className={`mb-2`}>
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
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => toggleAdmin(item.id)}
                className={`px-3 py-1 rounded-full ${isAdmin ? 'bg-yellow-500' : 'bg-gray-600'}`}
              >
                <Text className="text-xs text-white">
                  {isAdmin ? 'Админ' : 'Участник'}
                </Text>
              </TouchableOpacity>
              <View className="w-5 h-5 rounded-full bg-white justify-center items-center">
                <Text className="text-[#4ECDC4] text-xs">✓</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#344d67] p-5">
      <Text className="text-white text-xl font-bold mb-5">Создать канал</Text>

      <TextInput
        placeholder="Название канала"
        placeholderTextColor="#aaa"
        value={groupName}
        onChangeText={setGroupName}
        className="w-full p-4 bg-gray-700 text-white rounded-lg mb-4"
      />

      <TextInput
        placeholder="@username (опционально)"
        placeholderTextColor="#aaa"
        value={groupUsername}
        onChangeText={setGroupUsername}
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
          <Text className="text-white font-semibold mb-2">
            Участники ({selectedUsers.length}) — нажмите для назначения админа
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {selectedUsers.map(user => (
              <View
                key={user.id}
                className={`rounded-full px-3 py-1 flex-row items-center ${adminUsers.has(user.id) ? 'bg-yellow-500' : 'bg-[#4ECDC4]'}`}
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
        disabled={loading}
        className={`p-4 rounded-lg ${loading ? 'bg-gray-600' : 'bg-[#4ECDC4]'}`}
      >
        <Text className="text-center text-white font-semibold">
          {loading
            ? 'Создание...'
            : `Создать канал (+${selectedUsers.length} участников, ${adminUsers.size} админов)`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default CreateChannel;
