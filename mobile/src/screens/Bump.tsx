// Simple Bump screen - button only
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { bumpService, type BumpServiceState, type NearbyPeer } from '../lib/bumpService';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, fonts } from '../lib/theme';
import { BRANDING } from '../config/branding';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BG = '#0E2A30';

export default function BumpScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [bumpState, setBumpState] = useState<BumpServiceState>('scanning');
  const [peer, setPeer] = useState<NearbyPeer | null>(null);

  const onStateChange = useCallback((state: BumpServiceState, p?: NearbyPeer) => {
    setBumpState(state);
    if (p) setPeer(p);

    if (state === 'found') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (state === 'confirmed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  useEffect(() => {
    const unsub = bumpService.on(onStateChange);
    if (user) bumpService.startScanning(user.id);
    return () => { unsub(); bumpService.stop(); };
  }, [user, onStateChange]);

  // DEV: simulate tap progression
  const devTap = useCallback(() => {
    if (bumpState === 'scanning') {
      onStateChange('found', { userId: 99, username: 'nearby_user', sessionToken: 'dev' });
    } else if (bumpState === 'found') {
      onStateChange('confirmed', peer ?? undefined);
    }
  }, [bumpState, peer, onStateChange]);

  const statusColor =
    bumpState === 'confirmed' ? colors.teal :
    bumpState === 'found' ? colors.yellow :
    'rgba(234,167,47,0.6)';

  const statusLabel =
    bumpState === 'confirmed' ? `${BRANDING.STATUS_CONFIRMED.toUpperCase()} ✦` :
    bumpState === 'found' ? (peer?.username.toUpperCase() ?? BRANDING.STATUS_FOUND.toUpperCase()) :
    BRANDING.STATUS_READY.toUpperCase();

  const hint =
    bumpState === 'confirmed' ? BRANDING.HINT_CONNECTED :
    bumpState === 'found' ? BRANDING.HINT_TAP_TO_CONNECT :
    BRANDING.HINT_SIMULATE;

  const borderColor =
    bumpState === 'confirmed' ? colors.yellow :
    bumpState === 'found' ? colors.teal :
    colors.teal;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <Pressable style={styles.closeBtn} onPress={() => nav.goBack()} hitSlop={12}>
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>

      <Text style={styles.screenTitle}>{BRANDING.CONNECT_SCREEN_TITLE.toUpperCase()}</Text>

      {/* Status info */}
      <View style={styles.info}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>

        {(bumpState === 'found' || bumpState === 'confirmed') && peer && (
          <View style={styles.peerRow}>
            <Avatar
              username={peer.username}
              avatar={peer.avatar}
              size={48}
              borderColor={bumpState === 'confirmed' ? colors.teal : colors.yellow}
            />
            <Text style={styles.peerName}>{peer.username.toUpperCase()}</Text>
          </View>
        )}

        <Text style={styles.hint}>{hint}</Text>
      </View>

      {/* Small bump button at bottom */}
      <Pressable 
        style={[styles.bumpBtn, { borderColor }]}
        onPress={devTap}
      >
        <Text style={styles.bumpBtnText}>
          {bumpState === 'confirmed' ? '✓' : bumpState === 'found' ? 'CONNECT' : 'SIMULATE'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    paddingVertical: 48,
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
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 20,
  },
  animationContainer: {
    height: '30%',
    width: '100%',
    backgroundColor: 'red',
    marginVertical: 100,
  },
  info: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
  statusText: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 3,
    textAlign: 'center',
  },
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
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: 'rgba(244,232,193,0.45)',
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 18,
  },
  bumpBtn: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 20,
  },
  bumpBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.cream,
  },
});
