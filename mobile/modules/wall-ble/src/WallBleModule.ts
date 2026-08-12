import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { WallBleModuleEvents } from './WallBle.types';

declare class WallBleModule extends NativeModule<WallBleModuleEvents> {
  start(userId: number, username: string): Promise<void>;
  stop(): Promise<void>;
}

export default requireOptionalNativeModule<WallBleModule>('WallBle');
