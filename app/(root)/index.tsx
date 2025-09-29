import { useCall } from '@/context/call-context';
import { getCurrentUser, getUserGroups } from '@/lib/api';
import { User } from '@/lib/types';
import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ChatItem {
  id: number;
  name: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastMessageType?: 'text' | 'image' | 'video' | 'document' | 'voice';
  lastMessageTime?: Date;
  lastSender?: {
    id: number;
    name: string;
    avatarUrl?: string;
  };
  isChat: boolean;
  isPrivate: boolean;
  participantsCount: number;
  unreadCount?: number;
  isLastMessageRead?: boolean;
  interlocutor?: {
    id: number;
    name: string;
    avatarUrl?: string;
  } | null;
  customName?: string | null;
  members?: Array<{
    id: number;
    userId: number;
    groupId: number;
    user: User;
  }>;
}

export const unstable_settings = {
  headerShown: false,
};

export default function Home() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { onNewMessage } = useCall();

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onNewMessage((data) => {
      const { message, groupId } = data;

      setChats((prev) => {
        const chatIndex = prev.findIndex((c) => c.id === groupId);
        if (chatIndex === -1) return prev;

        const updatedChat = { ...prev[chatIndex] };

        // Обновляем lastMessage
        updatedChat.lastMessage = message.content || '';
        updatedChat.lastMessageTime = new Date(message.createdAt);
        updatedChat.lastSender = {
          id: message.user.id,
          name: message.user.name,
          avatarUrl: message.user.avatar,
        };

        // Тип сообщения
        if (message.attachments?.length > 0) {
          const type = message.attachments[0].type;
          updatedChat.lastMessageType = type === 'image' ? 'image'
            : type === 'video' ? 'video'
            : type === 'voice' ? 'voice'
            : type === 'document' ? 'document' : 'text';
        } else {
          updatedChat.lastMessageType = 'text';
        }

        // Увеличиваем unreadCount, если сообщение не от текущего пользователя
        if (message.userId !== currentUser.id) {
          updatedChat.unreadCount = (updatedChat.unreadCount || 0) + 1;
        }

        // Сортируем: свежие — наверху
        const newChats = [...prev];
        newChats[chatIndex] = updatedChat;
        newChats.sort((a, b) => {
          const timeA = a.lastMessageTime?.getTime() || 0;
          const timeB = b.lastMessageTime?.getTime() || 0;
          return timeB - timeA;
        });

        return newChats;
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
      if (user) {
        await loadChats(user.id);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      setLoading(false);
    }
  };

  const loadChats = async (currentUserId: number) => {
    try {
      setLoading(true);
      console.log('Начало загрузки чатов для пользователя:', currentUserId);
      
      const allChats = await getUserGroups();
      console.log('Результат getUserGroups:', allChats);

      if (!allChats || !Array.isArray(allChats)) {
        console.log('Получен не массив:', typeof allChats, allChats);
        setChats([]);
        return;
      }

      console.log('Получен массив длиной:', allChats.length);

      const chatItems: ChatItem[] = allChats.map(chat => {
        try {
          console.log('Обработка чата:', chat.id, chat.name);
          
          const lastMessage = chat.lastMessage;
          
          let lastMessageType: ChatItem['lastMessageType'] = 'text';
          if (lastMessage?.attachments?.length > 0) {
            const firstAttachment = lastMessage.attachments[0];
            switch (firstAttachment.type) {
              case 'image': lastMessageType = 'image'; break;
              case 'video': lastMessageType = 'video'; break;
              case 'voice': lastMessageType = 'voice'; break;
              case 'document': lastMessageType = 'document'; break;
            }
          }

          // ИСПРАВЛЕНИЕ: Используем interlocutor из API, который уже правильно определен
          let interlocutor = chat.interlocutor || undefined;
          let customName = chat.customName || null;
          
          // Дополнительная проверка для приватных чатов
          if (chat.isPrivate && chat.members && !interlocutor) {
            const otherMember = chat.members.find(m => m.userId !== currentUserId);
            if (otherMember?.user) {
              interlocutor = {
                id: otherMember.user.id,
                name: otherMember.user.name,
                avatar: otherMember.user.avatar
              };
            }
          }

          return {
            id: chat.id,
            name: chat.name,
            avatarUrl: chat.avatarUrl,
            lastMessage: lastMessage?.content || '',
            lastMessageType,
            lastMessageTime: lastMessage ? new Date(lastMessage.createdAt) : undefined,
            lastSender: lastMessage?.user ? {
              id: lastMessage.user.id,
              name: lastMessage.user.name,
              avatarUrl: lastMessage.user.avatar,
            } : undefined,
            isChat: chat.isChat || false,
            isPrivate: chat.isPrivate || false,
            participantsCount: chat._count?.members || chat.members?.length || 0,
            unreadCount: chat.unreadCount || 0,
            isLastMessageRead: chat.isLastMessageRead ?? true,
            interlocutor: interlocutor,
            customName: customName,
            members: chat.members
          };
        } catch (error) {
          console.error('Ошибка обработки чата:', chat, error);
          return null;
        }
      }).filter(chat => chat !== null) as ChatItem[];

      chatItems.sort((a, b) => {
        const timeA = a.lastMessageTime?.getTime() || 0;
        const timeB = b.lastMessageTime?.getTime() || 0;
        return timeB - timeA;
      });

      console.log('Успешно создано чатов:', chatItems.length);
      setChats(chatItems);
      
    } catch (error: any) {
      console.error('Полная ошибка загрузки чатов:', error);
      console.error('Сообщение ошибки:', error.message);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const getLastMessagePreview = (item: ChatItem) => {
    switch (item.lastMessageType) {
      case 'image':
        return '📷 Фото';
      case 'video':
        return '🎥 Видео';
      case 'voice':
        return '🎙️ Голосовое';
      case 'document':
        return '📄 Документ';
      case 'text':
      default:
        return item.lastMessage || 'Пустое сообщение';
    }
  };

  const getDisplayName = (item: ChatItem) => {
    // Если это приватный чат И есть кастомное имя - показываем его
    if (item.isPrivate && item.customName) {
      return item.customName;
    }
    
    // Если это приватный чат без кастомного имени - показываем имя собеседника
    if (item.isPrivate && item.interlocutor) {
      return item.interlocutor.name;
    }
    
    // Для групп и обычных чатов показываем название чата
    return item.name;
  };

  const getAvatarSource = (item: ChatItem) => {
    // Для приватных чатов используем аватар собеседника
    if (item.isPrivate && item.interlocutor) {
      return item.interlocutor.avatarUrl;
    }
    // Для групп используем аватар группы
    return item.avatarUrl;
  };

  const getAvatarFallback = (item: ChatItem) => {
    const displayName = getDisplayName(item);
    return displayName.charAt(0).toUpperCase();
  };

  const renderChatItem = ({ item }: { item: ChatItem }) => {
    const isGroup = !item.isChat && item.participantsCount > 2;
    const isMine = currentUser && item.lastSender?.id === currentUser.id;
  
    const displayName = getDisplayName(item);
    const avatarSource = getAvatarSource(item);
    const avatarFallback = getAvatarFallback(item);
  
    return (
      <Link
        href={{
          pathname: '/chat/[id]',
          params: {
            id: item.id,
            isChat: String(item.isChat),
          },
        }}
        asChild
      >
        <TouchableOpacity className="p-4 border-b border-gray-700">
          <View className="flex-row items-center">
            {/* Аватар */}
            {avatarSource ? (
              <Image
                source={{ uri: avatarSource }}
                className="w-12 h-12 rounded-full mr-3"
              />
            ) : (
              <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-3">
                <Text className="text-white font-bold text-lg">
                  {avatarFallback}
                </Text>
              </View>
            )}
  
            <View className="flex-1">
              {/* Название чата или имя собеседника */}
              <View className="flex-row items-center">
                <Text className="text-white font-semibold text-lg">
                  {displayName}
                </Text>
                {/* Индикатор, что это контакт с кастомным именем */}
                {item.isPrivate && item.customName && item.interlocutor && (
                  <Text className="text-gray-400 text-xs ml-2">
                    ({item.interlocutor.name})
                  </Text>
                )}
              </View>

              {/* Последнее сообщение */}
              {item.lastMessage !== undefined && (
                <View className="flex-row items-center mt-1">
                  {isGroup && item.lastSender && (
                    <Text
                      className={`text-md mr-1 ${
                        isMine ? 'text-blue-400' : 'text-gray-300'
                      }`}
                    >
                      {isMine ? 'Вы:' : `${item.lastSender.name}:`}
                    </Text>
                  )}
  
                  <Text
                    className="text-gray-400 text-md flex-shrink"
                    numberOfLines={1}
                  >
                    {getLastMessagePreview(item)}
                  </Text>
  
                  {isMine && (
                    <Text className="ml-2 text-xs">
                      {item.isLastMessageRead ? '✔✔' : '✔'}
                    </Text>
                  )}
                </View>
              )}
            </View>
  
            {/* Блок справа с временем и непрочитанными */}
            <View className="items-end">
              {/* Время последнего сообщения */}
              {item.lastMessageTime && (
                <Text className="text-gray-500 text-xs mb-1">
                  {formatTime(item.lastMessageTime)}
                </Text>
              )}
              
              {/* Непрочитанные сообщения */}
              {Number(item.unreadCount) > 0 && (
                <View className="bg-red-500 rounded-full w-6 h-6 items-center justify-center">
                  <Text className="text-white text-xs">{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Link>
    );
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Вчера';
    } else if (days < 7) {
      return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('ru-RU');
    }
  };

  if (loading || !currentUser) {
    return (
      <View className="flex-1 bg-[#1a1a1a] justify-center items-center">
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#1a1a1a]">
      <View className="p-4 border-b border-gray-700">
        <Text className="text-white text-2xl font-bold">Чаты</Text>
      </View>

      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={item => `${item.isChat ? 'chat' : 'group'}-${item.id}`}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-8">
            <Text className="text-gray-400 text-center">
              У вас пока нет чатов. Создайте новый чат или группу!
            </Text>
          </View>
        }
      />
    </View>
  );
}