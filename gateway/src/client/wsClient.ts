type WsEventType =
  | "order_state_changed"
  | "payout_released"
  | "dispute_created"
  | "dispute_resolved"
  | "order_finalized"
  | "connected"
  | "disconnected"
  | "error";

type WsListener<T = unknown> = (data: T) => void;

interface WsClientConfig {
  baseUrl: string;
  apiKey: string;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export class FlowStateWsClient {
  private baseUrl: string;
  private apiKey: string;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<WsListener>> = new Map();
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentDelay: number;

  constructor({
    baseUrl,
    apiKey,
    reconnectDelayMs = 1000,
    maxReconnectDelayMs = 30000,
  }: WsClientConfig) {
    this.baseUrl = baseUrl.replace(/^http/, "ws").replace(/\/$/, "");
    this.apiKey = apiKey;
    this.reconnectDelay = reconnectDelayMs;
    this.maxReconnectDelay = maxReconnectDelayMs;
    this.currentDelay = reconnectDelayMs;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit("disconnected", null);
  }

  on<T = unknown>(event: WsEventType, listener: WsListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as WsListener);
    return () => this.off(event, listener);
  }

  off<T = unknown>(event: WsEventType, listener: WsListener<T>): void {
    this.listeners.get(event)?.delete(listener as WsListener);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }

  private openSocket(): void {
    try {
      this.ws = new WebSocket(`${this.baseUrl}/ws`);

      this.ws.onopen = () => {
        this.currentDelay = this.reconnectDelay;
        this.ws!.send(JSON.stringify({ type: "auth", token: this.apiKey }));
        this.emit("connected", null);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            payload: unknown;
          };
          this.emit(msg.type, msg.payload);
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onerror = (event) => {
        this.emit("error", event);
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        } else {
          this.emit("disconnected", null);
        }
      };
    } catch (err) {
      this.emit("error", err);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
      this.currentDelay = Math.min(this.currentDelay * 2, this.maxReconnectDelay);
    }, this.currentDelay);
  }
}
