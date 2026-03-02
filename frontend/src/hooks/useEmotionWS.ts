"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WSEmotionPayload } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/emotion";

interface UseEmotionWSOptions {
  autoConnect?: boolean;
  onMessage?: (payload: WSEmotionPayload) => void;
}

export function useEmotionWS(options: UseEmotionWSOptions = {}) {
  const { autoConnect = false, onMessage } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastPayload, setLastPayload] = useState<WSEmotionPayload | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (ev) => {
      try {
        const payload: WSEmotionPayload = JSON.parse(ev.data);
        setLastPayload(payload);
        onMessageRef.current?.(payload);
      } catch {
        // ignore non-JSON
      }
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const sendFrame = useCallback((jpegBlob: Blob) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    jpegBlob.arrayBuffer().then((buf) => {
      wsRef.current?.send(buf);
    });
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return { connected, connect, disconnect, sendFrame, lastPayload };
}
