// Bump service — BLE discovery + UWB ranging
// Native layer hooks are stubbed; wire in react-native-ble-plx + NearbyInteraction module here.

export type BumpServiceState = 'scanning' | 'found' | 'ranging' | 'confirmed' | 'error';

export interface NearbyPeer {
  userId: number;
  username: string;
  avatar?:   string;
  distance?: number;   // metres, from UWB ranging
  sessionToken: string;
}

type StateListener = (state: BumpServiceState, peer?: NearbyPeer) => void;

class BumpService {
  private listeners: StateListener[] = [];
  private state: BumpServiceState = 'scanning';

  on(fn: StateListener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  private emit(state: BumpServiceState, peer?: NearbyPeer) {
    this.state = state;
    this.listeners.forEach(l => l(state, peer));
  }

  async startScanning(myUserId: number) {
    this.emit('scanning');
    // TODO: start BLE advertisement with {userId: myUserId, sessionToken: generateNonce()}
    // TODO: start BLE scan for other Wall devices
    // TODO: on peer discovered → emit('found', peer)
    // TODO: start UWB ranging session with peer → emit('ranging', peer)
    // TODO: when UWB distance < 0.5m → emit('confirmed', peer)
  }

  stop() {
    // TODO: stop BLE scan + advertisement
    // TODO: stop UWB session
    this.emit('scanning');
  }

  getState() { return this.state; }
}

export const bumpService = new BumpService();
