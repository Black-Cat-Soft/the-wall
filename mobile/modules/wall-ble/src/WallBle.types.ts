export type BleNativeState = 'initializing' | 'scanning' | 'connecting' | 'found' | 'error';

export type BleStateEvent = {
  state: BleNativeState;
  message?: string;
};

export type BlePeerEvent = {
  userId: number;
  username: string;
  sessionToken: string;
  rssi?: number;
};

export type WallBleModuleEvents = {
  onStateChanged: (event: BleStateEvent) => void;
  onPeerChanged: (event: BlePeerEvent) => void;
};
