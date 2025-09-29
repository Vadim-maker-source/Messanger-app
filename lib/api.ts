import axios from 'axios';
import { Platform } from 'react-native';
import { getToken, removeToken, setToken } from './auth';
import { API_URL } from './config';
import { AuthResponse, Contact, Group, LoginCredentials, Message, RegisterCredentials, User } from './types';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Регистрация
export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  try {
    const response = await api.post<AuthResponse>('/register', credentials);
    await setToken(response.data.token)
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка регистрации');
  }
}

// Вход
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const response = await api.post<AuthResponse>('/login', credentials);
    await setToken(response.data.token)
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка входа');
  }
}

// Получить текущего пользователя
export async function getCurrentUser(): Promise<User | null> {
    try {
      const token = await getToken();
      
      if (!token) {
        return null;
      }
  
      const response = await api.get<{ user: User }>('/me', {
        headers: { 
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data.user;
    } catch (error: any) {
      console.error('Ошибка получения пользователя:', error);
      // Если токен невалидный, удаляем его
      if (error.response?.status === 401) {
        await removeToken();
      }
      return null;
    }
  }

// Получить пользователя по ID
export async function getUserById(userId: number): Promise<User> {
  try {
    const token = await getToken();
    const response = await api.get<{ user: User }>(`/user/${userId}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.user;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка получения пользователя');
  }
}

// Опционально: функция для установки токена по умолчанию
export function setAuthToken(token: string | null): void {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export async function createGroup(data: {
  name: string;
  username?: string;
  avatarUrl?: string;
  adminIds?: number[];
  memberIds?: number[];
  isChat: boolean
}): Promise<Group> {
  try {
    const token = await getToken();
    const response = await api.post<{ group: Group }>('/groups', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.group;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка создания группы');
  }
}

export async function createPrivateChat(participantId: number): Promise<Group> {
  try {
    const token = await getToken();
    const response = await api.post<{ group: Group }>('/private-chats', {
      participantId
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.group;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка создания приватного чата');
  }
}

// Получить все группы пользователя
export async function getUserGroups(): Promise<Group[]> {
  try {
    const token = await getToken();
    const response = await api.get<{ groups: Group[] }>('/groups', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.groups;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка загрузки групп');
  }
}

export async function getGroupById(groupId: number): Promise<Group & {
  unreadCount: number;
  isLastMessageRead: boolean;
}> {
  try {
    const token = await getToken();
    const response = await api.get(`/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.group;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка загрузки группы');
  }
}

export interface Attachment {
  type: 'image' | 'video' | 'document' | 'voice';
  url: string;
  filename?: string;
  size?: number;
}

export interface BlobFile {
  url: string;
  filename: string;
  size: number;
  type: 'image' | 'video' | 'document' | 'voice';
  pathname: string;
}

export const uploadFile = async (fileInfo: any, type: 'image' | 'video' | 'document' | 'voice'): Promise<BlobFile> => {
  try {
    const formData = new FormData();
    const token = await getToken();

    // --- FIX START ---
    let fileBlob: Blob;

    if (Platform.OS === 'web' && fileInfo.uri) {
      // On web, fetch the file as a Blob
      const response = await fetch(fileInfo.uri);
      fileBlob = await response.blob();
    } else {
      // On native, you can usually pass the object directly (Expo handles it)
      // But to be safe and consistent, we still construct a "file-like" object
      fileBlob = {
        uri: fileInfo.uri,
        type: fileInfo.mimeType || 'application/octet-stream',
        name: fileInfo.name || `file_${Date.now()}`,
      } as any;
    }

    formData.append('file', fileBlob, fileInfo.name || `file_${Date.now()}`);
    // --- FIX END ---

    formData.append('type', type);

    const response = await api.post('/uploadFile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      },
    });

    return response.data;

  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error(error.response?.data?.error || 'Ошибка загрузки файла');
  }
};

export const sendGroupMessage = async (
  groupId: number, 
  content: string, 
  attachments?: Omit<BlobFile, 'pathname'>[] // Убираем pathname из требований
): Promise<Message> => {
  try {
    const token = await getToken();
    const response = await api.post(`/groups/${groupId}/messages`, { 
      content, 
      attachments 
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    return response.data.message;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка отправки сообщения');
  }
};

export async function addGroupMember(groupId: number, userId: number) {
  try {
    const token = await getToken();
    const response = await api.post<{ member: any }>(`/groups/${groupId}/members`, { userId }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.member;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка добавления участника');
  }
}

export async function removeGroupMember(groupId: number, userId: number) {
  try {
    const token = await getToken();
    const response = await api.delete<{ member: any }>(`/groups/${groupId}/members/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.member;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка удаления участника');
  }
}

export async function promoteGroupAdmin(groupId: number, userId: number) {
  try {
    const token = await getToken();
    const response = await api.post<{ admin: any }>(`/groups/${groupId}/admins`, { userId }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.admin;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка назначения админа');
  }
}

export async function demoteGroupAdmin(groupId: number, userId: number) {
  try {
    const token = await getToken();
    const response = await api.delete<{ admin: any }>(`/groups/${groupId}/admins/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.admin;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка снятия админа');
  }
}

export async function updateGroup(groupId: number, data: { name?: string; username?: string; avatarUrl?: string }) {
  try {
    const token = await getToken();
    const response = await api.put<{ group: any }>(`/groups/${groupId}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.group;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка обновления группы');
  }
}

export async function getLastMessage(groupId: number) {
  try {
    const group = await getGroupById(groupId);
    const lastMessage = group.messages?.[group.messages.length - 1] ?? null; // безопасно
    return lastMessage;
  } catch (e) {
    console.error('Ошибка получения lastMessage:', e);
    return null;
  }
}

export async function searchUsers(query: string): Promise<User[]> {
  try {
    const token = await getToken();
    const response = await api.get<{ users: User[] }>('/users/search', {
      params: { q: query },
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.users;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка поиска пользователей');
  }
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  try {
    const token = await getToken();
    const response = await api.get<{ user: User }>(`/users/phone/${phone}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.user;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // Пользователь не найден
    }
    throw new Error(error.response?.data?.error || 'Ошибка получения пользователя');
  }
}

export async function addContact(contactId: number, customName: string): Promise<Contact> {
  try {
    const token = await getToken();
    const response = await api.post<{ contact: Contact }>('/contacts', {
      contactId,
      customName
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.contact;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка добавления контакта');
  }
}

export async function removeContact(contactId: number): Promise<void> {
  try {
    const token = await getToken();
    await api.delete(`/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка удаления контакта');
  }
}

export interface Call {
  id: number;
  callerId: number;
  receiverId: number;
  callType: 'audio' | 'video';
  status: 'pending' | 'accepted' | 'rejected' | 'ended' | 'missed';
  startedAt?: string;
  endedAt?: string;
  duration?: number;
}

// Инициировать звонок
export async function initiateCall(receiverId: number, callType: 'audio' | 'video'): Promise<{ 
  success: boolean; 
  call: Call; 
  message: string 
}> {
  try {
    const token = await getToken();
    const response = await api.post('/calls', {
      receiverId,
      callType
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка инициации звонка');
  }
}

export async function acceptCall(callId: number): Promise<{ success: boolean; call: Call }> {
  try {
    const token = await getToken();
    const response = await api.put(`/calls/${callId}/accept`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка принятия звонка');
  }
}

export async function rejectCall(callId: number): Promise<{ success: boolean; call: Call }> {
  try {
    const token = await getToken();
    const response = await api.put(`/calls/${callId}/reject`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка отклонения звонка');
  }
}

export async function endCall(callId: number): Promise<{ success: boolean; call: Call }> {
  try {
    const token = await getToken();
    const response = await api.put(`/calls/${callId}/end`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка завершения звонка');
  }
}

export async function getCallHistory(page: number = 1, limit: number = 20): Promise<{ calls: Call[] }> {
  try {
    const token = await getToken();
    const response = await api.get('/calls/history', {
      params: { page, limit },
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка получения истории звонков');
  }
}

export async function getUserProfile(userId: number): Promise<{
  user: User;
  commonGroups: Group[];
  isContact: boolean;
}> {
  try {
    const token = await getToken();
    const response = await api.get(`/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка получения профиля');
  }
}

export const updateContact = async (contactId: number, customName: string) => {
  const response = await fetch(`${API_URL}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getToken()}`,
    },
    body: JSON.stringify({ customName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка обновления контакта');
  }

  return response.json();
};

export async function getActiveIncomingCalls(): Promise<{ calls: Call[] }> {
  try {
    const token = await getToken();
    const response = await api.get('/calls/active-incoming', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Ошибка получения активных звонков');
  }
}

export default api;