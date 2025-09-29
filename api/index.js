const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { put } = require("@vercel/blob");
const multer = require("multer");
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const http = require('http')

const prisma = new PrismaClient();
const app = express();
const JWT_SECRET = 'your-secret-key';
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

const server = http.createServer(app);




app.use(cors({
  origin: '*', // или укажи конкретные origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
const PORT = 5000;

const wss = new WebSocket.Server({ server });

const userSockets = new Map();

wss.on('connection', (ws, request) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001, 'Токен не предоставлен');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id;
if (!userId) {
  ws.close(4002, 'Нет ID пользователя в токене');
  return;
}
    userSockets.set(userId, ws);

    ws.on('close', () => {
      userSockets.delete(userId);
    });

    ws.on('error', () => {
      userSockets.delete(userId);
    });
  } catch (err) {
    ws.close(4002, 'Неверный токен');
  }
});

// Middleware проверки токена
function checkToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Нет токена' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Неверный токен' });
  }
}



// Регистрация
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, number } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверяем есть ли пользователь
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email уже занят' });
    }

    // Хешируем пароль и создаем пользователя
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, number },
    });

    // Создаем токен
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Возвращаем без пароля
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });

  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Ищем пользователя
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    // Создаем токен
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Возвращаем без пароля
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });

  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить текущего пользователя
app.get('/me', checkToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, avatar: true, bio: true, createdAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить пользователя по ID
app.get('/user/:id', checkToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Получаем профиль пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        number: true,
        bio: true,
        avatar: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем совместные чаты
    const commonGroups = await prisma.group.findMany({
      where: {
        members: {
          some: { userId: req.userId }
        },
        AND: {
          members: {
            some: { userId: userId }
          }
        }
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isPrivate: true,
        isChat: true,
        _count: {
          select: { members: true }
        }
      }
    });

    const contact = await prisma.contact.findUnique({
      where: {
        userId_contactId: {
          userId: req.userId,
          contactId: userId
        }
      }
    });

    res.json({
      user: {
        ...user,
        customName: contact?.customName || null
      },
      commonGroups,
      isContact: !!contact
    });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/contacts', checkToken, async (req, res) => {
  try {
    const { contactId, customName } = req.body;
    
    if (!contactId || !customName) {
      return res.status(400).json({ error: 'ID контакта и кастомное имя обязательны' });
    }

    if (contactId === req.userId) {
      return res.status(400).json({ error: 'Нельзя добавить себя в контакты' });
    }

    // Проверяем существование пользователя
    const contactUser = await prisma.user.findUnique({
      where: { id: contactId }
    });

    if (!contactUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Создаем или обновляем контакт
    const contact = await prisma.contact.upsert({
      where: {
        userId_contactId: {
          userId: req.userId,
          contactId: contactId
        }
      },
      update: {
        customName: customName
      },
      create: {
        userId: req.userId,
        contactId: contactId,
        customName: customName
      },
      select: {
        id: true,
        customName: true,
        contact: {
          select: {
            id: true,
            name: true,
            avatar: true,
            number: true
          }
        }
      }
    });

    res.json({ contact });
  } catch (error) {
    console.error('Ошибка добавления контакта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/contacts/:contactId', checkToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const { customName } = req.body;
    
    if (!customName) {
      return res.status(400).json({ error: 'Имя контакта обязательно' });
    }

    const contact = await prisma.contact.update({
      where: {
        userId_contactId: {
          userId: req.userId,
          contactId: contactId
        }
      },
      data: {
        customName: customName
      },
      select: {
        id: true,
        customName: true,
        contact: {
          select: {
            id: true,
            name: true,
            avatar: true,
            number: true
          }
        }
      }
    });

    res.json({ contact });
  } catch (error) {
    console.error('Ошибка обновления контакта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление контакта
app.delete('/contacts/:contactId', checkToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    
    const contact = await prisma.contact.delete({
      where: {
        userId_contactId: {
          userId: req.userId,
          contactId: contactId
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления контакта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});



// Инициация аудио/видео звонка (заглушка)
app.post('/calls', checkToken, async (req, res) => {
  try {
    const { receiverId, callType } = req.body;
    const callerId = req.userId;

    if (!receiverId || !['audio', 'video'].includes(callType)) {
      return res.status(400).json({ error: 'Неверные параметры звонка' });
    }

    // Создаём запись в БД
    const call = await prisma.call.create({
      data: {
        callerId,
        receiverId,
        callType,
        status: 'pending',
      },
    });

    // Отправляем уведомление через WebSocket
    const receiverSocket = userSockets.get(receiverId);
    if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
      receiverSocket.send(
        JSON.stringify({
          type: 'incoming_call',
          call: {
            id: call.id,
            callerId,
            callType,
            startedAt: new Date().toISOString(),
          },
        })
      );
    }

    res.json({
      success: true,
      message: `Звонок ${callType} инициирован`,
      call: {
        id: call.id,
        callerId,
        receiverId,
        callType,
        status: 'pending',
        startedAt: call.startedAt,
      },
    });

    console.log('📞 Звонок от', callerId, 'к', receiverId);
console.log('🔌 Подключены пользователи:', Array.from(userSockets.keys()));
  } catch (error) {
    console.error('Ошибка инициации звонка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Принять звонок
app.put('/calls/:callId/accept', checkToken, async (req, res) => {
  try {
    const callId = parseInt(req.params.callId);
    const call = await prisma.call.findUnique({ where: { id: callId } });

    if (!call || call.receiverId !== req.userId) {
      return res.status(404).json({ error: 'Звонок не найден' });
    }

    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: { status: 'accepted', startedAt: new Date() },
    });

    // Уведомляем звонящего
    const callerSocket = userSockets.get(call.callerId);
    if (callerSocket?.readyState === WebSocket.OPEN) {
      callerSocket.send(
        JSON.stringify({
          type: 'call_accepted',
          callId,
        })
      );
    }

    res.json({ success: true, call: updatedCall });
  } catch (error) {
    console.error('Ошибка принятия звонка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отклонить / завершить звонок
const endCall = async (callId, status) => {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call || call.status === 'ended' || call.status === 'rejected') return call;

  const now = new Date();
  const duration = call.startedAt ? Math.floor((now.getTime() - call.startedAt.getTime()) / 1000) : 0;

  return prisma.call.update({
    where: { id: callId },
    data: {
      status,
      endedAt: now,
      duration: status === 'accepted' ? duration : null,
    },
  });
};

app.put('/calls/:callId/reject', checkToken, async (req, res) => {
  try {
    const callId = parseInt(req.params.callId);
    const call = await prisma.call.findUnique({ where: { id: callId } });

    if (!call || call.receiverId !== req.userId) {
      return res.status(404).json({ error: 'Звонок не найден' });
    }

    const updatedCall = await endCall(callId, 'rejected');

    // Уведомляем звонящего
    const callerSocket = userSockets.get(call.callerId);
    if (callerSocket?.readyState === WebSocket.OPEN) {
      callerSocket.send(
        JSON.stringify({
          type: 'call_rejected',
          callId,
        })
      );
    }

    res.json({ success: true, call: updatedCall });
  } catch (error) {
    console.error('Ошибка отклонения звонка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/calls/:callId/end', checkToken, async (req, res) => {
  try {
    const callId = parseInt(req.params.callId);
    const call = await prisma.call.findUnique({ where: { id: callId } });

    if (!call || (call.callerId !== req.userId && call.receiverId !== req.userId)) {
      return res.status(403).json({ error: 'Нет доступа к звонку' });
    }

    const updatedCall = await endCall(callId, 'ended');

    // Уведомляем другого участника
    const otherId = call.callerId === req.userId ? call.receiverId : call.callerId;
    const otherSocket = userSockets.get(otherId);
    if (otherSocket?.readyState === WebSocket.OPEN) {
      otherSocket.send(
        JSON.stringify({
          type: 'call_ended',
          callId,
        })
      );
    }

    res.json({ success: true, call: updatedCall });
  } catch (error) {
    console.error('Ошибка завершения звонка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить историю звонков
app.get('/calls/history', checkToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.userId;
    const skip = (Number(page) - 1) * Number(limit);

    const calls = await prisma.call.findMany({
      where: {
        OR: [{ callerId: userId }, { receiverId: userId }],
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: Number(limit),
    });

    res.json({ calls });
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});



app.get('/users/phone/:phone', checkToken, async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ error: 'Номер телефона обязателен' });
    }
    
    // Ищем пользователя по номеру телефона
    const user = await prisma.user.findFirst({
      where: { 
        number: {
          contains: phone.replace(/\D/g, ''), // Ищем по цифрам, игнорируя форматирование
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        number: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Ошибка получения пользователя по телефону:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ГРУППЫ

app.post('/groups', checkToken, async (req, res) => {
  try {
    const { name, username, avatarUrl, adminIds = [], memberIds, isChat } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название группы обязательно' });
    }

    if (username) {
      const existing = await prisma.group.findUnique({ where: { username } });
      if (existing) {
        return res.status(400).json({ error: 'Такой @username уже занят' });
      }
    }

    // Создаем группу
    const group = await prisma.group.create({
      data: {
        name,
        username,
        avatarUrl,
        ownerId: req.userId,
        members: {
          create: [
            { userId: req.userId }, // создатель — участник
            ...adminIds.map(id => ({ userId: id })),
            ...(memberIds || []).map(id => ({ userId: id })) // добавляем админов как участников
          ]
        },
        isChat,
        admins: {
          create: [
            { userId: req.userId }, // создатель — всегда админ
            ...adminIds.map(id => ({ userId: id })) // остальные админы
          ]
        }
      },
      include: {
        members: true,
        admins: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        },
        owner: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    res.status(201).json({ group });
  } catch (error) {
    console.error('Ошибка создания группы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/private-chats', checkToken, async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'ID участника обязателен' });
    }

    if (participantId === req.userId) {
      return res.status(400).json({ error: 'Нельзя создать чат с самим собой' });
    }

    // Проверяем существование пользователя
    const targetUser = await prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true, name: true, avatar: true }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, существует ли уже приватный чат между этими пользователями
    const existingChat = await prisma.group.findFirst({
      where: {
        isPrivate: true,
        members: {
          every: {
            userId: { in: [req.userId, participantId] }
          },
          some: {
            userId: req.userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    });

    if (existingChat) {
      return res.status(200).json({ group: existingChat });
    }

    // Создаем имя чата: "Чат с {Имя пользователя}"
    const chatName = `Чат с ${targetUser.name}`;

    // Создаем приватный чат
    const privateChat = await prisma.group.create({
      data: {
        name: chatName,
        ownerId: req.userId,
        isChat: true,
        isPrivate: true,
        members: {
          create: [
            { userId: req.userId },
            { userId: participantId }
          ]
        },
        admins: {
          create: [
            { userId: req.userId }
          ]
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        },
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        admins: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    });

    res.status(201).json({ group: privateChat });
  } catch (error) {
    console.error('Ошибка создания приватного чата:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/groups', checkToken, async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: req.userId
          }
        }
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        },
        _count: {
          select: { members: true, messages: true }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, avatar: true } }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Добавляем кастомные имена для приватных чатов
    const groupsWithCustomNames = await Promise.all(
      groups.map(async (group) => {
        if (group.isPrivate) {
          // ВАЖНО: Находим собеседника для текущего пользователя
          const otherMember = group.members.find(m => m.userId !== req.userId);
          if (otherMember) {
            // Ищем контакт текущего пользователя с этим собеседником
            const contact = await prisma.contact.findUnique({
              where: {
                userId_contactId: {
                  userId: req.userId, // ТЕКУЩИЙ пользователь
                  contactId: otherMember.userId // собеседник
                }
              }
            });
            return {
              ...group,
              customName: contact?.customName || null,
              // Добавляем информацию о собеседнике для удобства
              interlocutor: otherMember.user
            };
          }
        }
        return group;
      })
    );

    const groupsWithLastMessage = groupsWithCustomNames.map(group => {
      const lastMessage = group.messages[0] || null;
      return {
        ...group,
        lastMessage
      };
    });

    res.json({ groups: groupsWithLastMessage });
  } catch (error) {
    console.error('Ошибка получения групп:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/groups/:id', checkToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        admins: {
          include: { user: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        },
        messages: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            },
            attachments: true,
            MessageRead: {
              include: {
                user: { select: { id: true, name: true, avatar: true } }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    // Добавляем кастомное имя для приватных чатов
    let customName = null;
    if (group.isPrivate) {
      const otherMember = group.members.find(m => m.userId !== req.userId);
      if (otherMember) {
        const contact = await prisma.contact.findUnique({
          where: {
            userId_contactId: {
              userId: req.userId,
              contactId: otherMember.userId
            }
          }
        });
        customName = contact?.customName || null;
      }
    }

    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    // Проверяем, состоит ли пользователь в группе
    const isMember = group.members.some(m => m.userId === req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const getPublicBlobUrl = (pathname) => {
      return `https://tdxmoqprx1ban3pd.public.blob.vercel-storage.com/${pathname}`;
    };

    const messagesWithFreshAttachmentUrls = group.messages.map(msg => ({
      ...msg,
      // Обновляем URL для каждого вложения в сообщении
      attachments: msg.attachments.map(att => ({
        ...att,
        url: getPublicBlobUrl(att.pathname), // ← Генерируем актуальный URL по pathname
      })),
      // Определяем, прочитано ли сообщение
      isRead: msg.MessageRead.length > 0 ? msg.MessageRead[0].isRead : false,
    }));

    let unreadCount = 0;

    if (group?.messages) {
      unreadCount = group.messages.filter(
        msg => !(msg.MessageRead ?? []).some(r => r.userId === req.userId && r.isRead)
      ).length;
    }

    const lastMessage = group.messages[group.messages.length - 1];
    let isLastMessageRead = false;

    if (lastMessage && lastMessage.userId === req.userId) {
      const totalRecipients = group.members.length - 1;
      const readBy = (lastMessage.MessageRead ?? []).filter(
        r => r.isRead && r.userId !== req.userId
      ).length;

      isLastMessageRead = readBy === totalRecipients;
    }

    res.json({
      group: {
        ...group,
        isPrivate: group.isPrivate,
        customName,
        messages: messagesWithFreshAttachmentUrls,
        unreadCount,
        isLastMessageRead
      }
    });
  } catch (error) {
    console.error('Ошибка получения группы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/groups/:id/members', checkToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { admins: true, owner: true, members: true }
    });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    // Разрешаем добавлять только админам/владельцу
    const isOwner = group.ownerId === req.userId;
    const isAdmin = await prisma.groupAdmin.findUnique({
      where: { userId_groupId: { userId: req.userId, groupId } }
    });

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Только админы или владелец могут добавлять участников' });
    }

    // Проверяем уже существует ли
    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (existing) return res.status(400).json({ error: 'Пользователь уже в группе' });

    const member = await prisma.groupMember.create({
      data: { userId, groupId },
      include: { user: true }
    });

    res.status(201).json({ member });
  } catch (error) {
    console.error('Ошибка добавления участника:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить участника: DELETE /groups/:id/members/:userId
app.delete('/groups/:id/members/:userId', checkToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { admins: true, owner: true }
    });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    const isOwner = group.ownerId === req.userId;
    const isRequesterAdmin = await prisma.groupAdmin.findUnique({
      where: { userId_groupId: { userId: req.userId, groupId } }
    });

    // нельзя удалить владельца
    if (targetUserId === group.ownerId) {
      return res.status(400).json({ error: 'Нельзя удалить владельца' });
    }

    // если запрос пришёл от админа — он не может удалить другого админа
    const targetIsAdmin = await prisma.groupAdmin.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } }
    });

    if (!isOwner && isRequesterAdmin && targetIsAdmin) {
      return res.status(403).json({ error: 'Админ не может удалить другого админа' });
    }

    // только админ или владелец могут удалять
    if (!isOwner && !isRequesterAdmin) {
      return res.status(403).json({ error: 'Нет прав на удаление участника' });
    }

    // удаляем админскую запись, если есть
    if (targetIsAdmin) {
      await prisma.groupAdmin.delete({
        where: { userId_groupId: { userId: targetUserId, groupId } }
      }).catch(() => {});
    }

    // удаляем участника
    const deleted = await prisma.groupMember.delete({
      where: { userId_groupId: { userId: targetUserId, groupId } }
    });

    res.json({ member: deleted });
  } catch (error) {
    console.error('Ошибка удаления участника:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Назначить админом: POST /groups/:id/admins  body: { userId }
app.post('/groups/:id/admins', checkToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    // только владелец может назначать админов
    if (group.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Только владелец может назначать админов' });
    }

    // если уже админ — ничего
    const existing = await prisma.groupAdmin.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (existing) return res.status(400).json({ error: 'Пользователь уже админ' });

    // убедимся, что пользователь — участник (если нет — добавим)
    const member = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!member) {
      await prisma.groupMember.create({ data: { userId, groupId } });
    }

    const admin = await prisma.groupAdmin.create({
      data: { userId, groupId },
      include: { user: true }
    });

    res.status(201).json({ admin });
  } catch (error) {
    console.error('Ошибка назначения админа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Снять админов: DELETE /groups/:id/admins/:userId
app.delete('/groups/:id/admins/:userId', checkToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    // только владелец может снимать админку
    if (group.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Только владелец может снимать админов' });
    }

    // нельзя снять с владельца
    if (targetUserId === group.ownerId) {
      return res.status(400).json({ error: 'Нельзя снимать админку с владельца' });
    }

    const removed = await prisma.groupAdmin.delete({
      where: { userId_groupId: { userId: targetUserId, groupId } }
    });

    res.json({ admin: removed });
  } catch (error) {
    console.error('Ошибка удаления админа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/groups/:id', checkToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { name, username, avatarUrl } = req.body;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    // Проверяем права: владелец или админ
    const isOwner = group.ownerId === req.userId;
    const isAdmin = await prisma.groupAdmin.findUnique({
      where: { userId_groupId: { userId: req.userId, groupId } }
    });

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Нет прав на изменение группы' });
    }

    // Проверка username
    if (username) {
      const existing = await prisma.group.findUnique({ where: { username } });
      if (existing && existing.id !== groupId) {
        return res.status(400).json({ error: 'Такой @username уже занят' });
      }
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(name ? { name } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {})
      },
      include: {
        members: { include: { user: true } },
        admins: { include: { user: true } },
        owner: { select: { id: true, name: true, avatar: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { user: true } },
        _count: { select: { members: true, messages: true } }
      }
    });

    res.json({ group: updated });
  } catch (error) {
    console.error('Ошибка обновления группы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/groups/:id/messages', checkToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { content, attachments } = req.body;

    // Проверяем, что есть либо текст, либо вложения
    if (!content?.trim() && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    // Проверяем, является ли пользователь участником группы
    const member = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.userId, groupId } }
    });

    if (!member) {
      return res.status(403).json({ error: 'Вы не участник группы' });
    }

    // Проверяем валидность вложений
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (!attachment.url || !attachment.type) {
          return res.status(400).json({ error: 'Неверный формат вложений' });
        }
        
        if (!['image', 'video', 'document', 'voice'].includes(attachment.type)) {
          return res.status(400).json({ error: 'Неверный тип вложения' });
        }
      }
    }

    // Создаем сообщение с вложениями
    const message = await prisma.message.create({
      data: {
        content: content?.trim() || '',
        userId: req.userId,
        groupId: groupId,
        attachments: attachments && attachments.length > 0 ? {
          create: attachments.map(att => ({
            type: att.type,
            url: att.url,
            pathname: att.pathname,
            filename: att.filename || null,
            size: att.size || null,
          }))
        } : undefined,
      },
      include: {
        user: { 
          select: { 
            id: true, 
            name: true, 
            avatar: true 
          } 
        },
        attachments: true,
      }
    });

    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, avatar: true }
    });

    // Создаем записи о непрочитанном статусе
    const members = await prisma.groupMember.findMany({ 
      where: { groupId } 
    });

    const recipients = members.filter(m => m.userId !== req.userId);
    for (const recipient of recipients) {
      const recipientSocket = userSockets.get(recipient.userId);
      if (recipientSocket?.readyState === WebSocket.OPEN) {
        recipientSocket.send(JSON.stringify({
          type: 'new_message',
          message: {
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
            userId: req.userId,
            user: {
              id: currentUser.id,
              name: currentUser.name,
              avatar: currentUser.avatar,
            },
            attachments: message.attachments,
          },
          groupId: groupId,
        }));
      }
    }
    
    const unreadData = members
      .filter(m => m.userId !== req.userId)
      .map(m => ({
        userId: m.userId,
        messageId: message.id,
        isRead: false
      }));

    if (unreadData.length > 0) {
      await prisma.messageRead.createMany({ 
        data: unreadData 
      });
    }

    // Получаем полную информацию о сообщении
    const messageWithReads = await prisma.message.findUnique({
      where: { id: message.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        attachments: true,
        MessageRead: {  // ← Исправлено с reads на MessageRead
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({ message: messageWithReads });

  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Ошибка создания сообщения' });
  }
});

const upload = multer({
  storage: multer.memoryStorage(), // Храним файлы в памяти
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Проверяем тип файла
    if (file.mimetype.startsWith('image/') || 
        file.mimetype.startsWith('video/') || 
        file.mimetype.startsWith('audio/') ||
        file.mimetype.startsWith('application/')) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла'));
    }
  }
});

// Middleware для обработки ошибок multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 50MB' });
    }
    return res.status(400).json({ error: error.message });
  }
  next(error);
};

app.post('/uploadFile', checkToken, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('File:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');
    console.log('Body:', req.body);
    console.log('Headers:', req.headers);

    if (!req.file) {
      console.log('No file provided in request');
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }

    const { type } = req.body;
    console.log('File type from body:', type);

    if (!type || !['image', 'video', 'document', 'voice'].includes(type)) {
      return res.status(400).json({ error: 'Неверный тип файла' });
    }

    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 50MB' });
    }

    const fileExtension = req.file.originalname.split('.').pop() || 
                         (type === 'image' ? 'jpg' : 
                          type === 'video' ? 'mp4' : 'bin');
    
    const filename = `chat-files/${type}s/${uuidv4()}.${fileExtension}`;

    console.log('Uploading to blob storage:', filename);

    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: req.file.mimetype,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    console.log('Blob uploaded successfully:', blob.url);

    res.json({
      url: blob.url,
      filename: req.file.originalname,
      size: req.file.size,
      type: type,
      pathname: blob.pathname
    });

  } catch (error) {
    console.error('Upload error details:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла: ' + error.message });
  }
});

app.post('/groups/:id/read', checkToken, async (req, res) => {
  const groupId = parseInt(req.params.id);

  const messages = await prisma.message.findMany({
    where: {
      groupId,
      reads: { none: { userId: req.userId } }, // ещё нет записи
      userId: { not: req.userId },             // чужие сообщения
    },
    select: { id: true }
  });

  await prisma.$transaction(
    messages.map(m =>
      prisma.messageRead.create({
        data: { userId: req.userId, messageId: m.id, isRead: true }
      })
    )
  );

  res.json({ success: true, count: messages.length });
});

app.get('/users/search', checkToken, async (req, res) => {
  try {
    const { q } = req.query; // q — строка поиска

    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ],
        NOT: {
          id: req.userId // исключаем текущего пользователя
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true
      },
      take: 10 // ограничим выдачу
    });

    res.json({ users });
  } catch (error) {
    console.error('Ошибка поиска пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/groups/:id/read-all', checkToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);

    // Получаем все непрочитанные сообщения для пользователя
    const unreadMessages = await prisma.message.findMany({
      where: {
        groupId,
        reads: { none: { userId: req.userId, isRead: true } }
      },
      select: { id: true }
    });

    // Создаём или обновляем отметки
    for (const msg of unreadMessages) {
      await prisma.messageRead.upsert({
        where: { userId_messageId: { userId: req.userId, messageId: msg.id } },
        update: { isRead: true },
        create: { userId: req.userId, messageId: msg.id, isRead: true }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка отметки прочитанного:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});