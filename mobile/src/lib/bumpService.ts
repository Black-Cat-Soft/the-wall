import WallBle, {
  type BlePeerEvent,
  type BleStateEvent,
} from '../../modules/wall-ble';
import { api } from './api';

export type BumpServiceState =
  | 'idle'
  | 'initializing'
  | 'scanning'
  | 'connecting'
  | 'found'
  | 'confirming'
  | 'confirmed'
  | 'error';

export interface NearbyPeer {
  userId: number;
  username: string;
  avatar?: string;
  rssi?: number;
  sessionToken: string;
}

export interface BumpSnapshot {
  state: BumpServiceState;
  peer?: NearbyPeer;
  message?: string;
}

type StateListener = (snapshot: BumpSnapshot) => void;
type NativeSubscription = { remove: () => void };

export const BUMP_RSSI_THRESHOLD = -70;

class BumpService {
  private listeners: StateListener[] = [];
  private subscriptions: NativeSubscription[] = [];
  private snapshot: BumpSnapshot = { state: 'idle' };

  on(fn: StateListener) {
    this.listeners.push(fn);
    fn(this.snapshot);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  private emit(snapshot: BumpSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener(snapshot));
  }

  async startScanning(myUserId: number, username: string) {
    await this.stopNative();

    if (!WallBle) {
      this.emit({
        state: 'error',
        message: 'BLE needs the iOS development build. It is not available in Expo Go or on web.',
      });
      return;
    }

    this.emit({ state: 'initializing' });
    this.subscriptions = [
      WallBle.addListener('onStateChanged', (event: BleStateEvent) => {
        const state = event.state === 'error' ? 'error' : event.state;
        this.emit({ state, peer: this.snapshot.peer, message: event.message });
      }),
      WallBle.addListener('onPeerChanged', (event: BlePeerEvent) => {
        this.emit({ state: 'found', peer: event });
      }),
    ];

    try {
      await WallBle.start(myUserId, username);
    } catch (error) {
      this.emit({
        state: 'error',
        message: error instanceof Error ? error.message : 'Could not start Bluetooth.',
      });
    }
  }

  isCloseEnough(peer?: NearbyPeer) {
    return typeof peer?.rssi === 'number' && peer.rssi >= BUMP_RSSI_THRESHOLD;
  }

  async confirm(peer: NearbyPeer, token: string) {
    if (!this.isCloseEnough(peer)) {
      this.emit({ state: 'found', peer, message: 'Bring the phones closer before bumping.' });
      return;
    }

    this.emit({ state: 'confirming', peer });
    try {
      await api.bumps.create(peer.userId, 'ble', token);
      await this.stopNative();
      this.emit({ state: 'confirmed', peer });
    } catch (error) {
      this.emit({
        state: 'error',
        peer,
        message: error instanceof Error ? error.message : 'The bump could not be saved.',
      });
    }
  }

  async stop() {
    await this.stopNative();
    this.snapshot = { state: 'idle' };
  }

  getSnapshot() {
    return this.snapshot;
  }

  private async stopNative() {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    if (WallBle) {
      await WallBle.stop().catch(() => {});
    }
  }
}

export const bumpService = new BumpService();
