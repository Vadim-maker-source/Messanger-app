import { addGroupMember, createPrivateChat, demoteGroupAdmin, getCurrentUser, getGroupById, promoteGroupAdmin, removeGroupMember, searchUsers, updateGroup } from '@/lib/api';
import { BASE_URL } from '@/lib/config';
import { Group, User as TUser } from '@/lib/types';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import debounce from 'lodash.debounce';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

export default function ChatDataPage() {
  const { id, memberWord } = useLocalSearchParams();
  const router = useRouter();
  const groupId = parseInt(id as string);

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<TUser | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);

  // поиск/добавление участников
  const [addingOpen, setAddingOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const debouncedSearch = useCallback(
    debounce(async (q: string) => {
      if (!q || q.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const found = await searchUsers(q);
        setSearchResults(found);
      } catch (e: any) {
        Alert.alert('Ошибка поиска', e.message || String(e));
      } finally {
        setSearching(false);
      }
    }, 400),
    []
  );

  const [qrVisible, setQrVisible] = useState(false);

  const groupLink = group
  ? (group.username && group.username.trim()
      ? `${BASE_URL}/group/${group.id}`
      : `${BASE_URL}/group/${group.id}`)
  : '';
  
  const groupLinkUsername = `${BASE_URL}/`

// функция копирования
const handleCopyLink = async () => {
  if (!groupLink) return;
  try {
    await Clipboard.setStringAsync(groupLink);
    Alert.alert('Скопировано', 'Ссылка на группу скопирована в буфер обмена');
  } catch (e: any) {
    console.error(e);
    Alert.alert('Ошибка', 'Не удалось скопировать ссылку');
  }
};

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const load = async () => {
    try {
      setLoading(true);
      const u = await getCurrentUser();
      setCurrentUser(u);

      const g = await getGroupById(groupId);
      setGroup(g);
    } catch (e) {
      console.error('Ошибка загрузки данных группы:', e);
      Alert.alert('Ошибка', 'Не удалось загрузить данные группы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [groupId]);

  // утилиты прав
  const isOwner = () => !!(group && currentUser && group.ownerId === currentUser.id);
  const isAdmin = (userId?: number) => {
    if (!group || !userId) return false;
    return group.admins?.some(a => a.userId === userId);
  };
  const meIsAdminOrOwner = () => !!(group && currentUser && (group.ownerId === currentUser.id || group.admins?.some(a => a.userId === currentUser.id)));

  // Сортировка: админы (включая владельца) сверху, в пределах групп — по имени
  const getParticipantsSorted = () => {
    if (!group) return [];
    const members = group.members ?? [];
    const arr = members.map(m => {
      return {
        memberId: m.id,
        userId: m.userId,
        user: m.user,
        isAdmin: group.admins?.some(a => a.userId === m.userId) ?? false,
        isOwner: group.ownerId === m.userId,
      };
    });

    arr.sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return (a.user.name || '').localeCompare(b.user.name || '');
    });

    return arr;
  };

  // === Действия ===

  const handleAddMember = async (userId: number) => {
    try {
      setSearching(true);
      await addGroupMember(groupId, userId);
      Alert.alert('Готово', 'Пользователь добавлен');
      setSearchQuery('');
      setSearchResults([]);
      setAddingOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось добавить участника');
    } finally {
      setSearching(false);
    }
  };

  const handleRemoveMember = async (userId: number, name?: string) => {
    if (!group || !currentUser) return;
    // права: owner может удалять всех; admin может удалять не-admins и не-owner
    const requesterIsOwner = isOwner();
    const requesterIsAdmin = group.admins?.some(a => a.userId === currentUser.id);

    const targetIsAdmin = group.admins?.some(a => a.userId === userId);
    const targetIsOwner = group.ownerId === userId;

    if (!requesterIsOwner && !requesterIsAdmin) {
      return Alert.alert('Нет прав', 'Вы не можете удалять участников');
    }
    if (targetIsOwner) {
      return Alert.alert('Нельзя', 'Нельзя удалить владельца');
    }
    if (requesterIsAdmin && targetIsAdmin && !requesterIsOwner) {
      return Alert.alert('Нельзя', 'Админ не может удалить другого админа');
    }

    Alert.alert(
      'Подтвердите удаление',
      `Удалить ${name || 'пользователя'} из группы?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeGroupMember(groupId, userId);
              Alert.alert('Готово', 'Пользователь удалён');
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось удалить');
            }
          }
        }
      ]
    );
  };

  const handlePromote = async (userId: number, name?: string) => {
    if (!group || !currentUser) return;
    // только владелец может назначать
    if (!isOwner()) return Alert.alert('Нет прав', 'Только владелец может назначать админов');

    Alert.alert(
      'Назначить админом',
      `Назначить ${name || 'пользователя'} администратором?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Назначить',
          onPress: async () => {
            try {
              await promoteGroupAdmin(groupId, userId);
              Alert.alert('Готово', 'Пользователь стал админом');
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось назначить');
            }
          }
        }
      ]
    );
  };

  const handleDemote = async (userId: number, name?: string) => {
    if (!group || !currentUser) return;
    // только владелец может снимать
    if (!isOwner()) return Alert.alert('Нет прав', 'Только владелец может снимать админов');

    // нельзя снимать с владельца
    if (userId === group.ownerId) return Alert.alert('Нельзя', 'Нельзя снимать админку с владельца');

    Alert.alert(
      'Убрать админа',
      `Убрать у ${name || 'пользователя'} статус администратора?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Убрать',
          onPress: async () => {
            try {
              await demoteGroupAdmin(groupId, userId);
              Alert.alert('Готово', 'Статус администратора снят');
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось снять админа');
            }
          }
        }
      ]
    );
  };

  const handleEditGroup = async (name: string, username: string) => {
    if (!group) return;
    try {
      const updated = await updateGroup(group.id, { name, username: username ? username.replace(/^@/, '') : undefined });
      Alert.alert('Готово', 'Данные группы обновлены');
      setGroup(updated);
      setMenuOpen(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось обновить группу');
    }
  };

  const handleLeaveGroup = async () => {
  if (!group || !currentUser) return;
  Alert.alert(
    'Подтвердите',
    'Вы уверены, что хотите покинуть группу?',
    [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeGroupMember(group.id, currentUser.id);
            Alert.alert('Готово', 'Вы вышли из группы');
            router.back();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось выйти из группы');
          }
        }
      }
    ]
  );
};

// Открыть поиск участников (та же панель, что у тебя есть)
const handleOpenAddMember = () => {
  setAddingOpen(true);
};

// ✅ НОВАЯ ФУНКЦИЯ: Создание или открытие приватного чата
const handleOpenPrivateChat = async (userId: number, userName: string, userAvatar?: string) => {
  if (!currentUser) {
    Alert.alert('Ошибка', 'Пользователь не авторизован');
    return;
  }

  if (userId === currentUser.id) {
    Alert.alert('Ошибка', 'Нельзя создать чат с самим собой');
    return;
  }

  try {
    setLoading(true);
    // Создаем или получаем существующий приватный чат
    const privateChat = await createPrivateChat(userId);
    
    // Переходим в чат
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: privateChat.id.toString(),
        isChat: 'true'
      }
    });
  } catch (error: any) {
    Alert.alert('Ошибка', error.message || 'Не удалось создать приватный чат');
  } finally {
    setLoading(false);
  }
};

const renderParticipant = ({ item }: { item: any }) => {
  const { user, userId } = item;
  const targetIsAdmin = item.isAdmin;
  const targetIsOwner = item.isOwner;
  const meIsOwner = isOwner();
  const meIsAdmin = currentUser ? group?.admins?.some(a => a.userId === currentUser.id) : false;

  return (
    <TouchableOpacity
      onPress={() => {
        if (userId !== currentUser?.id) {
          handleOpenPrivateChat(userId, user.name, user.avatar);
        }
      }}
      onLongPress={() => {
        setSelectedUser(item);
        setModalVisible(true);
      }}
      delayLongPress={500}
      className="p-3 border-b border-gray-700"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} className="w-10 h-10 rounded-full mr-3" />
          ) : (
            <View className="w-10 h-10 rounded-full bg-gray-500 mr-3 items-center justify-center">
              <Text className="text-white font-bold">{(user?.name?.charAt(0) || '?').toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text className="text-white font-medium">{user.name || user.customName}</Text>
            <Text className="text-gray-400 text-xs">
              {targetIsOwner ? 'Владелец' : targetIsAdmin ? 'Админ' : 'Участник'}
            </Text>
          </View>
        </View>
        {userId !== currentUser?.id && (
          <View className="ml-2">
            <FontAwesome name="chevron-right" size={16} color="#666" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

  // UI
  if (loading || !group) {
    return (
      <View className="flex-1 bg-[#1a1a1a] justify-center items-center">
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  const participants = getParticipantsSorted();

  const handleGoBack = () => {
    router.back();
  };

  return (
    <View className="flex-1 bg-[#1a1a1a]">
      {/* header */}
      <View className="w-full flex-row items-center justify-between py-3 px-6 bg-gray-800">
        <TouchableOpacity onPress={handleGoBack}>
          <FontAwesome 
            name="arrow-left" 
            size={20} 
            color={"white"} 
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuOpen(prev => !prev)} className="p-2">
          <FontAwesome name="ellipsis-vertical" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View className="border-b border-gray-700 flex-col justify-between bg-gray-800">
        <View className="flex-col items-center justify-center gap-4 pb-4">
          {group.avatarUrl ? (
            <Image source={{ uri: group.avatarUrl }} className="w-24 h-24 rounded-full mr-3" />
          ) : (
            <View className="w-24 h-24 rounded-full bg-blue-500 mr-3 items-center justify-center">
              <Text className="text-white font-bold text-5xl">{group.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View className="flex-col items-center justify-center">
            <Text className="text-white text-2xl font-bold">{group.name}</Text>
            <Text className="text-gray-400 text-md">
              {group._count?.members ?? group.members?.length ?? 0} участника
            </Text>
          </View>
        </View>

        <View className="flex-col bg-[#344d67]">
  <View className="flex-row items-center justify-between pr-6">
    <View className="flex-col justify-start py-5 px-6 gap-1">
      <Text className="text-white text-lg">
        {groupLink ? <Text className="text-white text-lg">{groupLinkUsername}<Text className="text-blue-400">@{group.username}</Text></Text> : 'Ссылка на группу'}
      </Text>
      <Text className="text-gray-400 text-md">Ссылка на группу</Text>
    </View>

    {/* Открываем модалку с QR-кодом */}
    <TouchableOpacity onPress={() => setQrVisible(true)}>
      <FontAwesome
        name="qrcode"
        size={25}
        color={"#60a5fa"}
      />
    </TouchableOpacity>
  </View>
</View>

{qrVisible && (
  <Modal
    transparent={true}
    animationType="fade"
    visible={qrVisible}
    onRequestClose={() => setQrVisible(false)}
  >
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 320, padding: 16, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 18, marginBottom: 12 }}>QR-код группы</Text>

        {/* QR */}
        <View style={{ backgroundColor: 'white', padding: 8, borderRadius: 8 }}>
          <QRCode value={groupLink} size={200} />
        </View>

        <Text style={{ color: '#9CA3AF', marginTop: 12, textAlign: 'center' }} numberOfLines={2}>
          {groupLink}
        </Text>

        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          <TouchableOpacity
            onPress={handleCopyLink}
            style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#2563EB', borderRadius: 8 }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Скопировать ссылку</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setQrVisible(false)}
            style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#374151', borderRadius: 8 }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
)}

        <View>

          {menuOpen && (
            <View className="absolute right-4 top-14 bg-[#202020] rounded-md p-2 shadow">
              {meIsAdminOrOwner() && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    Alert.prompt(
                      'Изменить название',
                      'Введите новое название группы',
                      [
                        { text: 'Отмена', style: 'cancel' },
                        {
                          text: 'Сохранить',
                          onPress: async (text) => {
                            try {
                              await handleEditGroup(text || group.name, group.username || '');
                              await load();
                            } catch (err) {
                              
                            }
                          }
                        }
                      ],
                      'plain-text',
                      group.name
                    );
                  }}
                  className="p-2"
                >
                  <Text className="text-white">Изменить группу</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  setAddingOpen(prev => !prev);
                }}
                className="p-2"
              >
                <Text className="text-white">Добавить участника</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {
                setMenuOpen(false);
                Alert.alert('Ссылка на группу', group.username ? `@${group.username}` : 'У группы нет username');
              }} className="p-2">
                <Text className="text-white">Ссылка на группу</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Add participant panel */}
      {addingOpen && (
        <View className="p-3 border-b border-gray-700 bg-[#222]">
          <TextInput
            placeholder="Поиск по имени или email..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="w-full p-3 bg-gray-700 text-white rounded-lg mb-2"
          />
          {searching && <ActivityIndicator size="small" color="#4ECDC4" />}
          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <View className="flex-row items-center justify-between p-2">
                  <View className="flex-row items-center">
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} className="w-10 h-10 rounded-full mr-2" />
                    ) : (
                      <View className="w-10 h-10 rounded-full bg-gray-500 mr-2 items-center justify-center">
                        <Text className="text-white">{item.name?.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text className="text-white">{item.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleAddMember(item.id)} className="px-3 py-1 rounded bg-[#4ECDC4]">
                    <Text className="text-white">Добавить</Text>
                  </TouchableOpacity>
                </View>
              )}
              style={{ maxHeight: 220 }}
            />
          ) : (
            searchQuery.length >= 2 && <Text className="text-gray-400">Пользователи не найдены</Text>
          )}
        </View>
      )}

      <View className="w-full flex-row items-center py-3 px-7">
  <TouchableOpacity onPress={handleLeaveGroup} className="flex-row items-center gap-4">
    <FontAwesome name="trash" size={25} color={"#f87171"} />
    <Text className="text-red-400">Выйти из группы</Text>
  </TouchableOpacity>
</View>

<View className="py-3 px-7">
  <TouchableOpacity onPress={handleOpenAddMember} className="flex-row items-center gap-3">
    <FontAwesome name="plus" size={25} color={"#60a5fa"} />
    <Text className="text-blue-400">Добавить участника</Text>
  </TouchableOpacity>
</View>

      {/* Участники */}
      <FlatList
        data={participants}
        keyExtractor={item => `member-${item.userId}`}
        renderItem={renderParticipant}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <Modal
  transparent
  visible={modalVisible}
  animationType="fade"
  onRequestClose={() => setModalVisible(false)}
>
  <View className="flex-1 bg-black/60 justify-center items-center">
    <View className="bg-[#2a2a2a] rounded-xl p-6 w-80">
      {selectedUser && (
        <>
          <Text className="text-white text-lg font-bold mb-4 text-center">
            {selectedUser.user.name}
          </Text>

          {/* Назначить админом */}
          {isOwner() && !selectedUser.isAdmin && !selectedUser.isOwner && (
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                handlePromote(selectedUser.userId, selectedUser.user.name);
              }}
              className="py-3 px-4 mb-2 rounded-lg bg-yellow-600"
            >
              <Text className="text-white text-center">Назначить админом</Text>
            </TouchableOpacity>
          )}

          {/* Снять админа */}
          {isOwner() && selectedUser.isAdmin && !selectedUser.isOwner && (
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                handleDemote(selectedUser.userId, selectedUser.user.name);
              }}
              className="py-3 px-4 mb-2 rounded-lg bg-gray-600"
            >
              <Text className="text-white text-center">Снять админа</Text>
            </TouchableOpacity>
          )}

          {/* Удалить */}
          {(isOwner() || (meIsAdminOrOwner() && !selectedUser.isAdmin && !selectedUser.isOwner)) && (
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                handleRemoveMember(selectedUser.userId, selectedUser.user.name);
              }}
              className="py-3 px-4 mb-2 rounded-lg bg-red-600"
            >
              <Text className="text-white text-center">Удалить из группы</Text>
            </TouchableOpacity>
          )}

          {/* Закрыть */}
          <TouchableOpacity
            onPress={() => setModalVisible(false)}
            className="py-3 px-4 mt-2 rounded-lg bg-gray-700"
          >
            <Text className="text-white text-center">Отмена</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  </View>
</Modal>
    </View>
  );
}