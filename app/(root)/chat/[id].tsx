import { renderWordMembers } from '@/constants/route';
import { getCurrentUser, getGroupById, sendGroupMessage, uploadFile } from '@/lib/api';
import { Group, Message, User } from '@/lib/types';
import Slider from '@react-native-community/slider';
import { Audio, ResizeMode, Video } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
const { width, height } = Dimensions.get('window');

export default function ChatScreen() {
  const { id, isChat: isChatParam } = useLocalSearchParams();
  const [chatData, setChatData] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [renderWordMem, setRenderWordMem] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<number | null>(null);
  
  // Модальные состояния
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState<{ type: string; data: any } | null>(null);
  
  // Выпадающее меню
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
  
  // Голосовые сообщения
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false); // Для продолжения записи
  
  // Звуковое воспроизведение
  const playbackSoundRef = useRef<Audio.Sound | null>(null);
  const [playingVoiceUrl, setPlayingVoiceUrl] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);
  const [voicePosition, setVoicePosition] = useState<number>(0);
  
  const chatId = parseInt(id as string);
  const isPrivateChat = chatData?.isPrivate === true;
  const [isAtBottom, setIsAtBottom] = useState(true);
  const paddingBottomAnim = useRef(new Animated.Value(20)).current;

  const [customName, setCustomName] = useState<string | null>(null);

  // В useEffect, где вы обновляете menuAnim:
  useEffect(() => {
    Animated.timing(paddingBottomAnim, {
      toValue: keyboardHeight > 0 ? 270 : 10,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // ← false, потому что padding не поддерживает native driver
    }).start();
  }, [keyboardHeight]);
  
  // Анимация меню
  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: isAttachmentMenuOpen ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isAttachmentMenuOpen]);
  
  // Слушатели клавиатуры
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Получаем текущего пользователя
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Ошибка получения пользователя:', error);
      }
    };
    fetchCurrentUser();
  }, []);
  
  // Загружаем чат и сообщения
  useEffect(() => {
    loadChatData();
    startPolling();
    return () => stopPolling();
  }, [chatId]);
  
  // Очистка звука при размонтировании
  useEffect(() => {
    return () => {
      if (playbackSoundRef.current) {
        playbackSoundRef.current.unloadAsync();
        playbackSoundRef.current = null;
      }
    };
  }, []);
  
  // Обновление позиции воспроизведения
  useEffect(() => {
    let intervalId: number | null = null;
    if (playingVoiceUrl && playbackSoundRef.current) {
      intervalId = setInterval(async () => {
        try {
          const status = await playbackSoundRef.current?.getStatusAsync();
          if (status?.isLoaded) {
            setVoicePosition(status.positionMillis / 1000);
            if (status.didJustFinish) {
              setPlayingVoiceUrl(null);
              setVoicePosition(0);
            }
          }
        } catch (error) {
          console.error('Error updating voice position:', error);
        }
      }, 100);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [playingVoiceUrl]);
  
  const loadChatData = async () => {
    try {
      setLoading(true);
      const data = await getGroupById(chatId);
      setChatData(data);
      setMessages(data.messages || []);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);

      // Убираем установку customName, т.к. он теперь приходит из API
      // if (data.isPrivate) {
      //   setCustomName(data.customName || null);
      // }
    } catch (error) {
      console.error('Ошибка загрузки чата:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить чат');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayNameForPrivateChat = () => {
    if (!chatData || !isPrivateChat) return null;
    
    // Используем кастомное имя из данных чата, если оно есть
    if (chatData.customName) {
      return chatData.customName;
    }
    
    // Иначе используем имя собеседника
    const interlocutor = getInterlocutor();
    return interlocutor?.name || 'Собеседник';
  };

  const getInterlocutor = () => {
    if (!chatData || !currentUser || !chatData.isPrivate) return null;
    
    const otherMember = chatData.members?.find(m => m.userId !== currentUser.id);
    if (!otherMember) return null;
    
    return otherMember.user;
  };
  
  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const data = await getGroupById(chatId);
        const newMessages = data.messages || [];
        if (newMessages.length !== messages.length) {
          setMessages(newMessages);
          if (isAtBottom) {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 500) as unknown as number;
  };
  
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };
  
  const handleScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setIsAtBottom(distanceFromBottom < 50);
  };
  
  const canSendMessage = () => {
    if (!chatData || !currentUser) return false;
    if (isPrivateChat) return true;
    if (chatData.isChat) return true;
    if (!chatData.isChat) {
      const isOwner = chatData.ownerId === currentUser.id;
      const isAdmin = chatData.admins?.some(admin => admin.userId === currentUser.id);
      return !!(isOwner || isAdmin);
    }
  };
  
  const pickImages = async () => {
    setIsAttachmentMenuOpen(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 6 - selectedFiles.length,
      });
      if (!result.canceled) {
        await processSelectedFiles(result.assets, 'image');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать изображения');
    }
  };
  
  const pickVideos = async () => {
    setIsAttachmentMenuOpen(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        quality: 0.7,
        selectionLimit: 6 - selectedFiles.length,
      });
      if (!result.canceled) {
        await processSelectedFiles(result.assets, 'video');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать видео');
    }
  };
  
  const pickDocuments = async () => {
    setIsAttachmentMenuOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.assets) {
        await processSelectedFiles(result.assets, 'document');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать документы');
    }
  };
  
  const processSelectedFiles = async (assets: any[], type: 'image' | 'video' | 'document') => {
    setIsUploading(true);
    for (const asset of assets) {
      try {
        if (asset.size && asset.size > 50 * 1024 * 1024) {
          Alert.alert('Ошибка', `Файл "${asset.name}" слишком большой. Максимальный размер: 50MB`);
          continue;
        }
        const uploadedFile = await uploadFile(asset, type);
        setSelectedFiles(prev => [...prev, {
          ...uploadedFile,
          localUri: asset.uri
        }]);
      } catch (error: any) {
        Alert.alert('Ошибка', error.message);
      }
    }
    setIsUploading(false);
  };
  
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const isSendingRef = useRef(false);
  
  const handleSendMessage = async () => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      if (!newMessage.trim() && selectedFiles.length === 0) return;
      if (!canSendMessage()) {
        Alert.alert('Доступ запрещен', 'Только администраторы или создатель могут писать в этом канале');
        return;
      }
      const attachments = selectedFiles.map(file => ({
        url: file.url,
        filename: file.filename,
        size: file.size,
        type: file.type,
        pathname: file.pathname
      }));
      const sentMessage = await sendGroupMessage(chatId, newMessage.trim(), attachments);
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      setSelectedFiles([]);
      Keyboard.dismiss();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    } finally {
      setTimeout(() => {
        isSendingRef.current = false;
      }, 1000);
    }
  };
  
  // ========================
  // ГОЛОСОВЫЕ СООБЩЕНИЯ
  // ========================
  
  const startRecording = async () => {
    try {
      console.log('Запрашиваем разрешение на запись...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Разрешение необходимо', 'Пожалуйста, разрешите доступ к микрофону в настройках.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setIsPaused(false);
      setRecordedUri(null);
      console.log('Запись началась');
    } catch (err) {
      console.error('Ошибка начала записи:', err);
      Alert.alert('Ошибка', 'Не удалось начать запись');
    }
  };
  
  const pauseRecording = async () => {
    if (!recording) return;
    try {
      await recording.pauseAsync();
      setIsPaused(true);
      console.log('Запись приостановлена');
    } catch (err) {
      console.error('Ошибка приостановки записи:', err);
      Alert.alert('Ошибка', 'Не удалось приостановить запись');
    }
  };
  
  const resumeRecording = async () => {
    if (!recording) return;
    try {
      await recording.startAsync();
      setIsPaused(false);
      console.log('Запись возобновлена');
    } catch (err) {
      console.error('Ошибка возобновления записи:', err);
      Alert.alert('Ошибка', 'Не удалось возобновить запись');
    }
  };
  
  const stopRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      setIsPaused(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      if (!uri) {
        Alert.alert('Ошибка', 'Не удалось получить файл записи');
        return;
      }
      // Получаем длительность записи
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri });
      const status = await sound.getStatusAsync();
      const duration = status.isLoaded ? status.durationMillis : 0;
      await sound.unloadAsync();
      // Загружаем файл
      setIsUploading(true);
      const fileInfo = {
        uri,
        name: `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
        mimeType: 'audio/m4a',
        size: 0,
      };
      try {
        const stat = await FileSystem.getInfoAsync(uri);
        if (stat.exists && 'size' in stat) {
          fileInfo.size = stat.size;
        } else {
          fileInfo.size = 0;
          console.warn('Файл не существует или не содержит размер');
        }
      } catch (e) {
        console.warn('Не удалось получить информацию о файле:', e);
        fileInfo.size = 0;
      }
      const uploadedFile = await uploadFile(fileInfo, 'voice');
      setSelectedFiles(prev => [...prev, {
        ...uploadedFile,
        localUri: uri,
        duration: duration ? duration / 1000 : 0 // Сохраняем длительность в секундах
      }]);
      setRecording(null);
      setIsUploading(false);
      console.log('Запись остановлена и загружена:', uploadedFile);
    } catch (err) {
      console.error('Ошибка остановки записи:', err);
      Alert.alert('Ошибка', 'Не удалось завершить запись');
      setIsUploading(false);
    }
  };
  
  const cancelRecording = async () => {
    if (recording) {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    }
    setIsRecording(false);
    setIsPaused(false);
    setRecordedUri(null);
    console.log('Запись отменена');
  };
  
  // Управление воспроизведением голосовых сообщений
  const playVoiceMessage = async (url: string, duration: number) => {
    try {
      // Если уже играет это же сообщение, ставим на паузу
      if (playingVoiceUrl === url) {
        if (playbackSoundRef.current) {
          const status = await playbackSoundRef.current.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await playbackSoundRef.current.pauseAsync();
            return;
          } else {
            await playbackSoundRef.current.playAsync();
            return;
          }
        }
      }
      // Если играет другое сообщение, останавливаем его
      if (playbackSoundRef.current) {
        await playbackSoundRef.current.stopAsync();
        await playbackSoundRef.current.unloadAsync();
      }
      // Загружаем новое сообщение
      playbackSoundRef.current = new Audio.Sound();
      await playbackSoundRef.current.loadAsync({ uri: url });
      await playbackSoundRef.current.playAsync();
      setPlayingVoiceUrl(url);
      setVoiceDuration(duration || 0);
      setVoicePosition(0);
    } catch (error) {
      console.error('Ошибка воспроизведения голосового сообщения:', error);
      Alert.alert('Ошибка', 'Не удалось воспроизвести голосовое сообщение');
    }
  };
  
  const stopVoiceMessage = async () => {
    try {
      if (playbackSoundRef.current) {
        await playbackSoundRef.current.stopAsync();
      }
      setPlayingVoiceUrl(null);
      setVoicePosition(0);
    } catch (error) {
      console.error('Ошибка остановки голосового сообщения:', error);
    }
  };
  
  const seekVoiceMessage = async (value: number) => {
    try {
      if (playbackSoundRef.current && playingVoiceUrl) {
        await playbackSoundRef.current.setPositionAsync(value * 1000);
        setVoicePosition(value);
      }
    } catch (error) {
      console.error('Ошибка перемотки голосового сообщения:', error);
    }
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const renderSelectedFiles = () => {
    if (selectedFiles.length === 0) return null;
    return (
      <ScrollView horizontal className="mb-3 mt-3" showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
        {isUploading && <ActivityIndicator size="small" color="#fff" />}
          {selectedFiles.map((file, index) => (
            <View key={index} className="relative">
              {file.type === 'image' ? (
                <Image
                  source={{ uri: file.localUri || file.url }}
                  className="w-16 h-16 rounded-lg"
                />
              ) : file.type === 'voice' ? (
                <View className="w-16 h-16 bg-purple-600 rounded-lg items-center justify-center">
                  <FontAwesome name="microphone" size={20} color="white" />
                </View>
              ) : (
                <View className="w-16 h-16 bg-gray-600 rounded-lg items-center justify-center">
                  <FontAwesome 
                    name={file.type === 'video' ? 'video-camera' : 'file'} 
                    size={20} 
                    color="white" 
                  />
                </View>
              )}
              <TouchableOpacity
                onPress={() => removeFile(index)}
                className="absolute -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center"
              >
                <FontAwesome name="times" size={12} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };
  
  // Обработчики открытия модалок
  const openImageModal = (url: string) => {
    setModalContent({ type: 'image', data: { url } });
    setModalVisible(true);
  };
  
  const openVideoModal = (url: string) => {
    setModalContent({ type: 'video', data: { url } });
    setModalVisible(true);
  };
  
  const openDocumentModal = (attachment: any) => {
    setModalContent({ type: 'document', data: attachment });
    setModalVisible(true);
  };
  
  // Действия для документа
  const handleShareDocument = async (url: string, filename: string) => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Ошибка', 'Функция отправки недоступна на этом устройстве.');
        return;
      }
      await Sharing.shareAsync(url, { dialogTitle: `Поделиться ${filename}` });
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось поделиться файлом');
    }
  };
  
  const handleOpenInBrowser = (url: string) => {
    Linking.openURL(url);
    setModalVisible(false);
  };
  
  const handleDownloadDocument = async (url: string, filename: string) => {
    try {
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      // @ts-ignore
      const fileUri = FileSystem.documentDirectory + sanitizedFilename;
      // @ts-ignore
      if (!FileSystem.documentDirectory) {
        throw new Error('Не удалось получить директорию для сохранения');
      }
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
          console.log(`Загрузка: ${progress.toFixed(1)}%`);
        }
      );
      const { uri } = await downloadResumable.downloadAsync();
      Alert.alert('✅ Успех', `Файл сохранён: ${sanitizedFilename}`, [
        {
          text: 'OK',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Sharing.shareAsync(uri);
            } else {
              // @ts-ignore
              FileSystem.openFile?.(uri).catch(err => {
                console.log('Не удалось открыть файл:', err);
              });
            }
          },
        },
      ]);
    } catch (error: any) {
      console.error("Ошибка загрузки:", error);
      Alert.alert('Ошибка', error.message || 'Не удалось скачать файл. Проверьте разрешения.');
    }
  };
  
  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = currentUser && item.userId === currentUser.id;
    const showSenderInfo = !isPrivateChat && (chatData?._count?.members || 0) > 2;
    return (
      <View className={`my-1 ${isMine ? 'self-end' : 'self-start'} max-w-[80%]`}>
        {showSenderInfo && (
          <View className="flex-row items-center mb-1">
            {isMine ? (
              <>
                {currentUser?.avatar ? (
                  <Image source={{ uri: currentUser.avatar }} className="w-6 h-6 rounded-full mr-2" />
                ) : (
                  <View className="w-6 h-6 bg-blue-500 rounded-full items-center justify-center mr-2">
                    <Text className="text-white text-xs">{currentUser?.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text className="text-blue-400 font-semibold">Вы</Text>
              </>
            ) : (
              <>
                {item.user?.avatar ? (
                  <Image source={{ uri: item.user.avatar }} className="w-6 h-6 rounded-full mr-2" />
                ) : (
                  <View className="w-6 h-6 bg-gray-500 rounded-full items-center justify-center mr-2">
                    <Text className="text-white text-xs">{item.user?.name?.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text className="text-gray-300 font-semibold">{item.user?.name}</Text>
              </>
            )}
          </View>
        )}
        <View className={`${item.attachments && item.attachments.length > 0 ? "p-1" : "p-2 px-3"} rounded-lg ${isMine ? 'bg-gradient-to-br from-blue-600 to-purple-500 android:bg-purple-500 ios:bg-purple-500 rounded-tr-none' : 'bg-gray-700 rounded-tl-none'}`}>
          {item.attachments && item.attachments.length > 0 && (
            <View className="gap-2 mb-1">
              {item.attachments.map((attachment, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    if (attachment.type === 'image') {
                      openImageModal(attachment.url);
                    } else if (attachment.type === 'video') {
                      openVideoModal(attachment.url);
                    } else if (attachment.type === 'voice') {
                      // Теперь голосовые сообщения воспроизводятся inline
                      const duration = attachment.duration || 0;
                      if (playingVoiceUrl === attachment.url) {
                        playVoiceMessage(attachment.url, duration);
                      } else {
                        playVoiceMessage(attachment.url, duration);
                      }
                    } else {
                      openDocumentModal(attachment);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  {attachment.type === 'image' ? (
                    <Image
                      source={{ uri: attachment.url }}
                      className="w-auto h-auto min-w-64 min-h-64 max-w-96 max-h-96 rounded-lg"
                      resizeMode="cover"
                    />
                  ) : attachment.type === 'video' ? (
                    <View className="w-auto h-auto min-w-64 min-h-64 max-w-96 max-h-96 bg-gray-600 rounded-lg items-center justify-center">
                      <FontAwesome name="play-circle" size={32} color="white" />
                    </View>
                  ) : attachment.type === 'voice' ? (
                    <View className="py-1 px-4 rounded-lg bg-gray-300/50">
                      <View className="flex-row items-center w-64">
                        <View className="rounded-full mr-1 flex-row items-center justify-center">
                          <FontAwesome 
                            name={playingVoiceUrl === attachment.url ? "pause" : "play"} 
                            size={20} 
                            color="purple" 
                          />
                        </View>
                        <Slider
                        style={{ width: 160, height: 40 }}
                        minimumValue={0}
                        maximumValue={attachment.duration || 1}
                        value={playingVoiceUrl === attachment.url ? voicePosition : 0}
                        onValueChange={seekVoiceMessage}
                        minimumTrackTintColor="#FFFFFF"
                        maximumTrackTintColor="#DDDDDD"
                        thumbTintColor="#FFFFFF"
                        disabled={playingVoiceUrl !== attachment.url}
                      />
                        <Text className="text-white text-sm">
                          {playingVoiceUrl === attachment.url 
                            ? `${formatTime(voiceDuration - voicePosition)}`
                            : `${formatTime(attachment.duration || 0)}`
                          }
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View className="p-3 bg-gray-600 rounded-lg flex-row items-center">
                      <FontAwesome name="file" size={20} color="white" />
                      <Text className="text-white text-md ml-2 flex-1" numberOfLines={1}>
                        {attachment.filename}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          {item.content ? <Text className={`text-white text-lg ${item.attachments && item.attachments.length > 0 ? "p-1" : "p-0"}`}>{item.content}</Text> : null}
          <View className="flex-row justify-end items-center mt-1">
            <Text className="text-gray-300 text-xs mr-1">
              {new Date(item.createdAt).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  };
  
  const router = useRouter();
  const handleGoBack = () => router.back();
  
  useEffect(() => {
    if (chatData?.members?.length !== undefined) {
      const word = renderWordMembers(chatData.members.length);
      setRenderWordMem(word);
    }
  }, [chatData?.members?.length]);
  
  if (loading) {
    return (
      <ImageBackground source={require('@/assets/images/chat-wlp.jpg')} className="flex-1 justify-center items-center">
        <View className="absolute inset-0 bg-black opacity-50" />
        <Text className="text-white">Загрузка...</Text>
      </ImageBackground>
    );
  }
  
  if (!chatData) {
    return (
      <ImageBackground source={require('@/assets/images/chat-wlp.jpg')} className="flex-1 justify-center items-center">
        <View className="absolute inset-0 bg-black opacity-50" />
        <Text className="text-white">Чат не найден</Text>
      </ImageBackground>
    );
  }
  
  // Интерполяция анимации
  const menuHeight = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });
  const menuOpacity = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleOpenInterlocutorProfile = () => {
    const interlocutor = getInterlocutor();
    if (!interlocutor) return;
    
    router.push({
      pathname: '/profile/[id]',
      params: { id: interlocutor.id.toString() }
    })
  };

  return (
    <ImageBackground source={require('@/assets/images/chat-wlp.jpg')} className="flex-1">
      <View className="absolute inset-0 bg-black opacity-50" />
      {/* Основной контейнер */}
      <View className="flex-1">
        {/* Шапка чата */}
        <View className="p-4 border-b border-gray-700 flex-row items-center gap-6 bg-[#2e435a] bg-opacity-70">
          <TouchableOpacity onPress={handleGoBack}>
            <FontAwesome name="arrow-left" size={20} color={"white"} />
          </TouchableOpacity>
          
          {/* ✅ ИЗМЕНЕНО: Отображаем данные собеседника для приватных чатов */}
          {isPrivateChat ? (
            <TouchableOpacity onPress={handleOpenInterlocutorProfile} className="flex-row">
              {getInterlocutor()?.avatar ? (
                <Image source={{ uri: getInterlocutor()?.avatar }} className="w-12 h-12 rounded-full mr-3" />
              ) : (
                <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-3">
                  <Text className="text-white font-bold text-lg">
                    {getInterlocutor()?.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="flex-col">
                {/* ИСПРАВЛЕНО: Используем функцию для получения отображаемого имени */}
                <Text className="text-white text-xl font-bold">
                  {getDisplayNameForPrivateChat()}
                </Text>
                <Text className="text-gray-400 text-sm">
                  Приватный чат
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Link href={{ pathname: `/chat-data/[id]`, params: { id: chatData.id, memberWord: renderWordMem } }}>
              <View className="flex-row">
                {chatData.avatarUrl ? (
                  <Image source={{ uri: chatData.avatarUrl }} className="w-12 h-12 rounded-full mr-3" />
                ) : (
                  <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-3">
                    <Text className="text-white font-bold text-lg">{chatData.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View className="flex-col">
                  <Text className="text-white text-xl font-bold">{chatData.name}</Text>
                  <Text className="text-gray-400 text-sm">
                    {!chatData.isChat ? 'Канал' : 'Группа'} • {chatData.members?.length} {renderWordMem}
                  </Text>
                </View>
              </View>
            </Link>
          )}
        </View>

        {/* Контейнер сообщений */}
        <Animated.View 
          className="flex-1 px-4 pt-4"
          style={{
            paddingBottom: paddingBottomAnim,
          }}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id.toString()}
            className="flex-1"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingBottom: 20, // внутренний отступ для последнего сообщения
            }}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center pt-20">
                <Text className="text-gray-400">Нет сообщений</Text>
              </View>
            }
          />
        </Animated.View>
        
        {/* Контейнер ввода сообщения — ВСЕГДА внизу, над клавиатурой */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          className="bg-transparent"
        >
          <View
            className="bg-gray-700 border-t border-gray-700 px-2 pt-1"
            style={{
              // Поднимаем контейнер вместе с клавиатурой
              transform: [{ translateY: keyboardHeight > 0 ? -keyboardHeight : 0 }],
              // Добавляем отступ снизу, чтобы контейнер не "прилипал" к клавиатуре
              paddingBottom: keyboardHeight > 0 ? 16 : 10,
            }}
          >
            {renderSelectedFiles()}
            {canSendMessage() ? (
              <View>
                <View className="flex-row items-center">
                  {/* Кнопка "+" */}
                  <View className="relative ml-3">
                    <TouchableOpacity
                      onPress={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                      className="bg-gray-700 rounded-full items-center justify-center"
                      style={{ width: 20, height: 20 }}
                      disabled={isUploading}
                    >
                      <FontAwesome
                        name="paperclip"
                        size={22}
                        color={"#878787"}
                        className="rotate-90"
                      />
                    </TouchableOpacity>
                  </View>
                  {/* Поле ввода */}
                  <View className="flex-1 flex-row items-center bg-gray-700 rounded-2xl ml-2">
                    <TextInput
                      className="flex-1 text-white p-1"
                      placeholder="Введите сообщение..."
                      placeholderTextColor="#888"
                      value={newMessage}
                      onChangeText={setNewMessage}
                      multiline
                      maxLength={5000}
                      editable={!isUploading && !isRecording}
                      onSubmitEditing={handleSendMessage}
                      onFocus={() => {
                        // При фокусе — скроллим чат вниз
                        setTimeout(() => {
                          flatListRef.current?.scrollToEnd({ animated: true });
                        }, 100);
                      }}
                    />
                  </View>
                  <Animated.View
                    style={{
                      position: 'absolute',
                      bottom: 50,
                      left: 5,
                      width: 340,
                      height: isRecording ? 100 : 100,
                      padding: 20,
                      opacity: menuOpacity,
                      backgroundColor: '#000',
                      borderRadius: 12,
                      overflow: 'hidden',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 5,
                      gap: 6,
                      transform: [
                        { scaleY: menuAnim },
                        { translateY: menuAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, isRecording ? -20 : 0],
                        }) },
                      ],
                    }}
                    className="flex-row items-center justify-around pt-5"
                  >
                    <View>
                      <TouchableOpacity
                        onPress={pickImages}
                        className="flex-col items-center gap-1"
                        activeOpacity={0.8}
                      >
                        <FontAwesome name="image" size={22} color="#4ade80" className="bg-gray-800/50 flex-row items-center justify-center p-5 rounded-lg" />
                        <Text className="text-white">Фото</Text>
                      </TouchableOpacity>
                    </View>
                    <View>
                      <TouchableOpacity
                        onPress={pickVideos}
                        className="flex-col items-center gap-1"
                        activeOpacity={0.8}
                      >
                        <FontAwesome name="video-camera" size={22} color="#f87171" className="bg-gray-800/50 flex-row items-center justify-center p-5 rounded-lg" />
                        <Text className="text-white">Видео</Text>
                      </TouchableOpacity>
                    </View>
                    <View>
                      <TouchableOpacity
                        onPress={pickDocuments}
                        className="flex-col items-center gap-1"
                        activeOpacity={0.8}
                      >
                        <FontAwesome name="file" size={22} color="#a78bfa" className="text-violet-400 bg-gray-800/50 flex-row items-center justify-center p-5 rounded-lg" />
                        <Text className="text-white">Документ</Text>
                      </TouchableOpacity>
                    </View>
                    {!isRecording && (
                      <View>
                        <TouchableOpacity
                          onPress={startRecording}
                          className="flex-col items-center gap-1"
                          activeOpacity={0.8}
                        >
                          <FontAwesome name="microphone" size={22} color="#fb923c" className=" bg-gray-800/50 flex-row items-center justify-center p-5 px-6 rounded-lg" />
                          <Text className="text-white">Голосовое</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Animated.View>
                  <TouchableOpacity
                    onPress={isRecording ? stopRecording : handleSendMessage}
                    disabled={isUploading}
                    className={`p-2 rounded-2xl flex-row items-center justify-center ${
                      isRecording 
                        ? 'bg-red-600' 
                        : newMessage.trim() === "" && selectedFiles.length === 0 
                          ? "bg-gray-700/70" 
                          : "bg-purple-500"
                    }`}
                    style={{ width: 40, height: 40 }}
                  >
                    <FontAwesome 
                      name={isRecording ? "stop" : "send"}
                      size={17}
                      color="white"
                    />
                  </TouchableOpacity>
                </View>
                {/* Кнопки управления записью */}
                {isRecording && (
                  <View className="flex-row justify-between mt-2">
                    <TouchableOpacity
                      onPress={isPaused ? resumeRecording : pauseRecording}
                      className="flex-1 p-2 bg-yellow-600 rounded-lg items-center mr-2"
                    >
                      <Text className="text-white">
                        {isPaused ? 'Продолжить запись' : 'Пауза'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={cancelRecording}
                      className="flex-1 p-2 bg-gray-600 rounded-lg items-center ml-2"
                    >
                      <Text className="text-white">Отменить</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View className="p-3 bg-yellow-600 rounded-lg">
                <Text className="text-white text-center text-sm">
                  Только администраторы или создатель могут писать в этот канал
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
      
      {/* Модальное окно */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black">
          {modalContent?.type === 'image' && (
            <Pressable
              className="flex-1 items-center justify-center"
              onPress={() => setModalVisible(false)}
            >
              <Image
                source={{ uri: modalContent.data.url }}
                style={{ width: width, height: height - 100, resizeMode: 'contain' }}
              />
            </Pressable>
          )}
          {modalContent?.type === 'video' && (
            <View className="flex-1 items-center justify-center p-4">
              <Video
                source={{ uri: modalContent.data.url }}
                rate={1.0}
                volume={1.0}
                isMuted={false}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                useNativeControls
                style={{ width: width - 32, height: height / 2 }}
                onError={(error) => {
                  console.error("Video error:", error);
                  Alert.alert("Ошибка", "Не удалось загрузить видео");
                  setModalVisible(false);
                }}
              />
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="mt-4 p-3 bg-red-600 rounded-lg"
              >
                <Text className="text-white">Закрыть</Text>
              </TouchableOpacity>
            </View>
          )}
          {modalContent?.type === 'document' && (
            <View className="flex-1 justify-center items-center p-6 bg-gray-900">
              <View className="w-full max-w-md bg-gray-800 rounded-xl p-6">
                <Text className="text-white text-lg font-bold mb-4">
                  {modalContent.data.filename}
                </Text>
                <TouchableOpacity
                  onPress={() => handleShareDocument(modalContent.data.url, modalContent.data.filename)}
                  className="p-4 bg-blue-600 rounded-lg mb-3"
                >
                  <Text className="text-white text-center">📤 Поделиться</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleOpenInBrowser(modalContent.data.url)}
                  className="p-4 bg-green-600 rounded-lg mb-3"
                >
                  <Text className="text-white text-center">🌐 Открыть в браузере</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDownloadDocument(modalContent.data.url, modalContent.data.filename)}
                  className="p-4 bg-purple-600 rounded-lg mb-3"
                >
                  <Text className="text-white text-center">💾 Скачать</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="p-4 bg-gray-600 rounded-lg mt-4"
                >
                  <Text className="text-white text-center">Отмена</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </ImageBackground>
  );
}