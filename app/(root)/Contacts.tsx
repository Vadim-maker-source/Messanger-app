import { createPrivateChat, getUserByPhone } from '@/lib/api';
import * as ExpoContacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';

interface ContactItem {
  id: string;
  name: string;
  phoneNumbers: string[];
  hasAccount: boolean;
  user?: {
    id: number;
    name: string;
    avatar?: string;
  };
}

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      
      // Запрашиваем разрешение на доступ к контактам
      const { status } = await ExpoContacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Разрешение необходимо',
          'Пожалуйста, разрешите доступ к контактам в настройках устройства',
          [{ text: 'OK' }]
        );
        setPermissionGranted(false);
        return;
      }

      setPermissionGranted(true);

      // Получаем все контакты с номерами телефонов
      const { data } = await ExpoContacts.getContactsAsync({
        fields: [ExpoContacts.Fields.PhoneNumbers, ExpoContacts.Fields.Name],
        sort: ExpoContacts.SortTypes.FirstName,
      });

      // Фильтруем контакты, у которых есть номера телефонов
      const contactsWithPhones = data.filter(contact => 
        contact.phoneNumbers && contact.phoneNumbers.length > 0
      );

      // Форматируем номера и создаём список контактов
      const formattedContacts: ContactItem[] = contactsWithPhones.map(contact => ({
        id: contact.id || '',
        name: contact.name || 'Без имени',
        phoneNumbers: contact.phoneNumbers?.map(p => 
          formatPhoneNumber(p.number?.toString() || '')
        ).filter(phone => phone.length > 0) || [],
        hasAccount: false,
      }));

      // Проверяем, какие контакты зарегистрированы в приложении
      const contactsWithAccounts = await checkContactsInApp(formattedContacts);
      
      setContacts(contactsWithAccounts);
    } catch (error) {
      console.error('Ошибка загрузки контактов:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить контакты');
    } finally {
      setLoading(false);
    }
  };

  // Форматируем номер телефона для сравнения
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    // Удаляем все нецифровые символы
    const digitsOnly = phone.replace(/\D/g, '');
    if (!digitsOnly) return '';
    
    // Для российских номеров: 89991234567 → 79991234567
    if (digitsOnly.startsWith('8') && digitsOnly.length === 11) {
      return '7' + digitsOnly.substring(1);
    }
    
    // Убираем +7 → 7
    if (digitsOnly.startsWith('+7')) {
      return digitsOnly.substring(2);
    }
    
    // Убираем + и оставляем как есть для международных
    if (digitsOnly.startsWith('+')) {
      return digitsOnly.substring(1);
    }
    
    return digitsOnly;
  };

  // Проверяем, какие контакты зарегистрированы в приложении
  const checkContactsInApp = async (contactList: ContactItem[]): Promise<ContactItem[]> => {
    try {
      const results = await Promise.all(
        contactList.map(async (contact) => {
          for (const phoneNumber of contact.phoneNumbers) {
            try {
              const user = await getUserByPhone(phoneNumber);
              if (user) {
                return { ...contact, hasAccount: true, user };
              }
            } catch (error) {
              // Пользователь не найден — продолжаем
            }
          }
          return contact;
        })
      );
      
      // Сортируем: сначала с аккаунтом
      return results.sort((a, b) => {
        if (a.hasAccount && !b.hasAccount) return -1;
        if (!a.hasAccount && b.hasAccount) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Ошибка проверки контактов:', error);
      return contactList;
    }
  };

  // Создание или открытие приватного чата
  const handleOpenPrivateChat = async (userId: number) => {
    try {
      setLoading(true);
      const privateChat = await createPrivateChat(userId);
      router.push({
        pathname: '/chat/[id]',
        params: { id: privateChat.id.toString(), isChat: 'true' }
      });
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось создать чат');
    } finally {
      setLoading(false);
    }
  };

  const renderContactItem = ({ item }: { item: ContactItem }) => {
    if (!item.hasAccount) return null; // Показываем ТОЛЬКО тех, кто в приложении

    return (
      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-700"
        onPress={() => handleOpenPrivateChat(item.user!.id)}
      >
        <View className="w-12 h-12 rounded-full bg-blue-500 items-center justify-center mr-4">
          {item.user?.avatar ? (
            <Image source={{ uri: item.user.avatar }} className="w-12 h-12 rounded-full" />
          ) : (
            <Text className="text-white font-bold text-lg">
              {item.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        
        <View className="flex-1">
          <Text className="text-lg font-semibold text-white">{item.name}</Text>
          {item.phoneNumbers.length > 0 && (
            <Text className="text-sm text-gray-400">{item.phoneNumbers[0]}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#1a1a1a] justify-center items-center">
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text className="mt-4 text-gray-400">Загрузка контактов...</Text>
      </View>
    );
  }

  if (!permissionGranted) {
    return (
      <View className="flex-1 bg-[#1a1a1a] justify-center items-center p-6">
        <Text className="text-xl text-white text-center mb-4">Нужен доступ к контактам</Text>
        <Text className="text-gray-400 text-center mb-8">
          Разрешите доступ к контактам, чтобы найти друзей в приложении.
        </Text>
        <TouchableOpacity 
          className="bg-blue-500 px-6 py-3 rounded-lg"
          onPress={loadContacts}
        >
          <Text className="text-white font-semibold">Запросить доступ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#1a1a1a]">
      <View className="p-4 border-b border-gray-700">
        <Text className="text-2xl font-bold text-white">Контакты</Text>
        <Text className="text-gray-400 mt-1">Друзья в приложении</Text>
      </View>
      
      {contacts.filter(c => c.hasAccount).length === 0 ? (
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-gray-400 text-center">
            Нет контактов, которые используют это приложение
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
};

export default Contacts;