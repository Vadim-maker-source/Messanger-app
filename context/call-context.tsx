import { acceptCall, Call, getUserProfile, rejectCall } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { WS_URL } from '@/lib/config';
import { useRouter } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type IncomingCall = Call & { callerName?: string; callerAvatar?: string };

// === НОВОЕ: Типы WebSocket-событий ===
type SocketEvent =
  | { type: 'incoming_call'; call: Omit<Call, 'status'> }
  | { type: 'call_accepted'; callId: number }
  | { type: 'call_rejected'; callId: number }
  | { type: 'call_ended'; callId: number }
  | { type: 'new_message'; message: any; groupId: number };

interface CallContextType {
  incomingCall: IncomingCall | null;
  hideIncomingCall: () => void;
  onNewMessage: (callback: (data: any) => void) => () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [messageCallbacks, setMessageCallbacks] = useState<Array<(data: any) => void>>([]);
  const router = useRouter();

  const hideIncomingCall = () => setIncomingCall(null);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connect = async () => {
      const token = await getToken();
      if (!token) return;

      ws = new WebSocket(`ws://${WS_URL}?token=${token}`);

      ws.onopen = () => console.log('✅ WebSocket подключён');
      ws.onerror = (e) => console.error('❌ WebSocket error:', e);
      ws.onclose = () => {
        console.log('🔌 WebSocket закрыт');
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'incoming_call') {
            try {
              const callerProfile = await getUserProfile(data.call.callerId);
              // ✅ Добавляем callerName и callerAvatar, не используем null
              setIncomingCall({
                ...data.call,
                callerName: callerProfile.user.name,
                callerAvatar: callerProfile.user.avatar || undefined, // ← undefined, не null
                status: 'pending', // ← добавляем, чтобы соответствовать типу
              });
            } catch (err) {
              setIncomingCall({
                ...data.call,
                callerName: 'Неизвестный',
                callerAvatar: undefined,
                status: 'pending',
              });
            }
          }

          if (
            data.type === 'call_ended' ||
            data.type === 'call_rejected' ||
            data.type === 'call_accepted'
          ) {
            if (incomingCall && data.callId === incomingCall.id) {
              hideIncomingCall();
            }
          }

          if (data.type === 'new_message') {
            messageCallbacks.forEach(cb => cb(data));
          }
        } catch (err) {
          console.error('Ошибка обработки WebSocket сообщения:', err);
        }
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, [incomingCall]);

  const onNewMessage = (callback: (data: any) => void) => {
    setMessageCallbacks(prev => [...prev, callback]);
    return () => {
      setMessageCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  };

  const handleAccept = async () => {
    if (!incomingCall) return;
    try {
      await acceptCall(incomingCall.id);
      hideIncomingCall();
      router.push({
        pathname: '/active-call',
        params: {
          call: JSON.stringify(incomingCall),
          isReceiver: 'true',
        },
      });
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
      hideIncomingCall();
    }
  };

  const handleReject = async () => {
    if (!incomingCall) return;
    try {
      await rejectCall(incomingCall.id);
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      hideIncomingCall();
    }
  };

  return (
    <CallContext.Provider value={{ incomingCall, hideIncomingCall, onNewMessage }}>
      {children}

      <Modal
        transparent
        visible={!!incomingCall}
        animationType="slide"
        onRequestClose={handleReject}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.avatarContainer}>
              {incomingCall?.callerAvatar ? (
                <Image source={{ uri: incomingCall.callerAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {incomingCall?.callerName?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.name}>{incomingCall?.callerName || 'Пользователь'}</Text>
            <Text style={styles.type}>
              Входящий {incomingCall?.callType === 'video' ? 'видео' : 'аудио'} звонок
            </Text>

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
                <Text style={styles.rejectText}>Отклонить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                <Text style={styles.acceptText}>Принять</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e0e0',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  type: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 20,
    width: '100%',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  acceptText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  rejectText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});