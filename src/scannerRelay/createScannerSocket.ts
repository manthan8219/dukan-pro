import { io, type Socket } from 'socket.io-client';
import { getApiBase } from '../api/baseUrl';

export function createScannerSocket(): Socket {
  return io(getApiBase(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    autoConnect: false,
  });
}
