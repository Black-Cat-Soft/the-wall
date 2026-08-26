import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import {
  BUMP_RSSI_THRESHOLD,
  bumpService,
  type BumpServiceState,
  type BumpSnapshot,
} from '../lib/bumpService';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, fonts } from '../lib/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BG = '#0E2A30';

function proximityLabel(rssi?: number) {
  if (typeof rssi !== 'number') return 'MEASURING DISTANCE…';
  if (rssi >= -55) return 'VERY CLOSE';
  if (rssi >= BUMP_RSSI_THRESHOLD) return 'CLOSE ENOUGH';
  return 'MOVE PHONES CLOSER';
}

export default function BumpScreen() {
  const nav = useNavigation<Nav>();
  const { token, user } = useAuth();
  const [snapshot, setSnapshot] = useState<BumpSnapshot>({ state: 'initializing' });
  const previousState = useRef<BumpServiceState>('idle');

  const onStateChange = useCallback((next: BumpSnapshot) => {
    if (next.state === 'found' && previousState.current !== 'found') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (next.state === 'confirmed' && previousState.current !== 'confirmed') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    previousState.current = next.state;
    setSnapshot(next);
  }, []);

  const start = useCallback(() => {
    if (user) {
      void bumpService.startScanning(user.id, user.username);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = bumpService.on(onStateChange);
    start();
    return () => {
      unsubscribe();
      void bumpService.stop();
    };
  }, [onStateChange, start]);

  const confirm = useCallback(() => {
    if (snapshot.peer && token) {
      void bumpService.confirm(snapshot.peer, token);
    }
  }, [snapshot.peer, token]);

  const closeEnough = bumpService.isCloseEnough(snapshot.peer);
  const isBusy = ['initializing', 'scanning', 'connecting', 'confirming'].includes(snapshot.state);
  const showPeer = Boolean(snapshot.peer) && ['found', 'confirming', 'confirmed'].includes(snapshot.state);

  const title =
    snapshot.state === 'confirmed' ? 'BUMPED ✦' :
    snapshot.state === 'found' ? snapshot.peer?.username.toUpperCase() :
    snapshot.state === 'confirming' ? 'SAVING BUMP…' :
    snapshot.state === 'connecting' ? 'CHECKING PEER…' :
    snapshot.state === 'error' ? 'BLUETOOTH PAUSED' :
    'LOOKING NEARBY';

  const hint =
    snapshot.state === 'confirmed' ? 'Connected! Their shots now appear on your wall.' :
    snapshot.state === 'found' ? proximityLabel(snapshot.peer?.rssi) :
    snapshot.state === 'connecting' ? 'Found a Wall device. Reading its identity…' :
    snapshot.state === 'error' ? (snapshot.message ?? 'Bluetooth could not start.') :
    'Open this screen on both iPhones and bring them together.';

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.closeBtn} onPress={() => nav.goBack()} hitSlop={12}>
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>

      <Text style={styles.screenTitle}>BUMP SOMEBODY</Text>

      <View style={styles.radar}>
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringMiddle]} />
        <View style={[styles.ring, styles.ringInner]} />
        <View style={[styles.centerDot, showPeer && styles.centerDotFound]} />
      </View>

      <View style={styles.info}>
        <Text style={[styles.statusText, snapshot.state === 'confirmed' && styles.confirmedText]}>
          {title}
        </Text>

        {showPeer && snapshot.peer && (
          <View style={styles.peerRow}>
            <Avatar
              username={snapshot.peer.username}
              avatar={snapshot.peer.avatar}
              size={48}
              borderColor={snapshot.state === 'confirmed' ? colors.teal : colors.yellow}
            />
            <View>
              <Text style={styles.peerName}>{snapshot.peer.username.toUpperCase()}</Text>
              {typeof snapshot.peer.rssi === 'number' && (
                <Text style={styles.signal}>SIGNAL {snapshot.peer.rssi} dBm</Text>
              )}
            </View>
          </View>
        )}

        <Text style={styles.hint}>{hint}</Text>
        {snapshot.message && snapshot.state === 'found' && (
          <Text style={styles.warning}>{snapshot.message}</Text>
        )}
      </View>

      <View style={styles.actions}>
        {isBusy && snapshot.state !== 'confirming' && (
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.yellow} />
            <Text style={styles.busyText}>BLE ACTIVE</Text>
          </View>
        )}

        {snapshot.state === 'found' && (
          <Pressable
            style={[styles.bumpBtn, !closeEnough && styles.bumpBtnDisabled]}
            onPress={confirm}
            disabled={!closeEnough}
          >
            <Text style={styles.bumpBtnText}>{closeEnough ? 'BUMP' : 'GET CLOSER'}</Text>
          </Pressable>
        )}

        {snapshot.state === 'confirming' && (
          <ActivityIndicator color={colors.yellow} size="large" />
        )}

        {snapshot.state === 'confirmed' && (
          <Pressable style={styles.bumpBtn} onPress={() => nav.goBack()}>
            <Text style={styles.bumpBtnText}>BACK TO WALL</Text>
          </Pressable>
        )}

        {snapshot.state === 'error' && (
          <Pressable style={styles.bumpBtn} onPress={start}>
            <Text style={styles.bumpBtnText}>TRY AGAIN</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    padding: 6,
    zIndex: 10,
  },
  closeIcon: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: 'rgba(244,232,193,0.5)',
  },
  screenTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 4,
    color: 'rgba(244,232,193,0.45)',
    marginTop: 14,
  },
  radar: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 42,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(37,176,154,0.28)',
    borderRadius: 999,
  },
  ringOuter: { width: 240, height: 240 },
  ringMiddle: { width: 164, height: 164 },
  ringInner: { width: 88, height: 88 },
  centerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.yellow,
    shadowColor: colors.yellow,
    shadowOpacity: 0.8,
    shadowRadius: 18,
  },
  centerDotFound: {
    backgroundColor: colors.teal,
    shadowColor: colors.teal,
    transform: [{ scale: 1.35 }],
  },
  info: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 26,
    width: '100%',
  },
  statusText: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 3,
    color: colors.yellow,
    textAlign: 'center',
  },
  confirmedText: { color: colors.teal },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peerName: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 2,
    color: colors.yellow,
  },
  signal: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: 'rgba(244,232,193,0.5)',
    marginTop: 3,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: 'rgba(244,232,193,0.55)',
    letterSpacing: 0.7,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 310,
  },
  warning: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.yellow,
    textAlign: 'center',
  },
  actions: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  busyText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: 'rgba(244,232,193,0.55)',
    letterSpacing: 1.5,
  },
  bumpBtn: {
    borderWidth: 2,
    borderColor: colors.teal,
    borderRadius: 8,
    paddingHorizontal: 34,
    paddingVertical: 14,
  },
  bumpBtnDisabled: {
    borderColor: 'rgba(244,232,193,0.3)',
    opacity: 0.6,
  },
  bumpBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.cream,
  },
});
