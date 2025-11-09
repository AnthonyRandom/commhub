import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
  gracefulLeaving?: boolean;
}

export interface VoiceMember {
  userId: number;
  username: string;
  hasCamera: boolean;
}
