export interface User {
    id: number;
    name: string;
    email?: string;
    password?: string;
    number?: number;
    bio?: string;
    avatar?: string;
    createdAt?: Date;
    customName?: string | null;
  }
  
  export interface AuthResponse {
    user: User;
    token: string;
  }
  
  export interface ApiError {
    error: string;
  }
  
  export interface LoginCredentials {
    email?: string;
    password: string;
    number?: string;
  }
  
  export interface RegisterCredentials extends LoginCredentials {
    name: string;
    number?: string;
  }

  export interface Contact {
  id: number;
  customName: string;
  contact: {
    id: number;
    name: string;
    avatar?: string;
    number?: string;
  };
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

  export interface Group {
    interlocutor?: User;
    lastMessage?: any;
    customName?: string | null;
    isLastMessageRead?: boolean;
    unreadCount?: number;
    participants?: any;
    id: number;
    name: string;
    username?: string;
    avatarUrl?: string;
    isChat: boolean;
    isPrivate?: boolean;
    ownerId: number;
    owner: User;
    createdAt: string;
    _count?: {
      members: number;
      messages: number;
    };
    members?: Array<{
      id: number;
      userId: number;
      groupId: number;
      user: User;
    }>;
    admins?: Array<{
      id: number;
      userId: number;
      groupId: number;
      user: User;
    }>;
    messages?: Message[];
  }

  
  
  export interface Message {
    id: number;
    content: string;
    userId: number;
    groupId?: number;
    user: User;
    createdAt: string;
    reads: MessageRead[];
    attachments?: Attachment[];
  }
  
  export interface Attachment {
    duration?: number;
    id?: number;
    messageId?: number;
    type: 'image' | 'video' | 'document' | 'voice';
    url: string;
    filename?: string;
    size?: number;
    createdAt?: string;
  }
  
  export interface BlobFile {
    url: string;
    filename: string;
    size: number;
    type: 'image' | 'video' | 'document' | 'voice';
    pathname: string;
  }

  export interface MessageRead {
    id: number;
    userId: number;
    messageId: number;
    isRead: boolean;
    createdAt: string;
  }