import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { api, type UserProfile } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../lib/theme';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackScreenProps<RootStackParamList, 'Profile'>['route'];

export default function ProfileScreen() {
  const { token, user, logout } = useAuth();
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;
  const isOwn = userId === user?.id;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setProfile(await api.users.profile(userId, token));
    } catch {
      nav.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, [userId]);

  const handleBump = async () => {
    if (!token || !profile) return;
    try {
      const { bumpStatus } = await api.users.bump(userId, token);
      setProfile(p => {
        if (!p) return null;
        const wasBumped = p.bumpStatus === 'bumped';
        const nowBumped = bumpStatus === 'bumped';
        return {
          ...p,
          bumpStatus,
          bumpCount: nowBumped ? p.bumpCount + 1 : wasBumped ? p.bumpCount - 1 : p.bumpCount,
        };
      });
    } catch { /* silent */ }
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>DEVELOPING…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.yellow} />

      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerName} numberOfLines={1}>
          {profile.username.toUpperCase()}
        </Text>
        {isOwn && (
          <Pressable onPress={logout}>
            <Text style={styles.logoutText}>LOG OUT</Text>
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* hero */}
        <View style={styles.hero}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarInitial}>
              {profile.username[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.heroName} numberOfLines={1}>
              {profile.username.toUpperCase()}
            </Text>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{profile.posts.length}</Text>
                <Text style={styles.statLabel}>SHOTS</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{profile.bumpCount}</Text>
                <Text style={styles.statLabel}>BUMPS</Text>
              </View>
            </View>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            {!isOwn && (
              <Pressable
                style={[styles.bumpBtn, profile.bumpStatus === 'bumped' && styles.bumpBtnBumped]}
                onPress={handleBump}
              >
                <Text style={[styles.bumpBtnText, profile.bumpStatus === 'bumped' && styles.bumpBtnTextBumped]}>
                  {profile.bumpStatus === 'bumped' ? 'BUMPED ✦' : 'BUMP'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* posts grid placeholder */}
        <View style={styles.gridPlaceholder}>
          <Text style={styles.gridPlaceholderText}>SHOTS COMING SOON</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 3,
    color: colors.muted,
  },

  header: {
    backgroundColor: colors.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: colors.orange,
    gap: 12,
  },
  backIcon: {
    fontSize: 32,
    color: colors.ink,
    lineHeight: 36,
    paddingRight: 4,
  },
  headerName: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.ink,
    flex: 1,
  },
  logoutText: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.ink,
    opacity: 0.6,
  },

  hero: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
    backgroundColor: colors.paper,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  avatarLg: {
    width: 76,
    height: 76,
    borderRadius: 6,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.white,
    lineHeight: 44,
  },
  heroMeta:  { flex: 1, gap: 8 },
  heroName: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 2,
    color: colors.ink,
    lineHeight: 30,
  },
  stats: { flexDirection: 'row', gap: 20 },
  stat:  { alignItems: 'center' },
  statNum: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 24,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  bio: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  bumpBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.red,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 2,
    borderColor: colors.red,
  },
  bumpBtnBumped: {
    backgroundColor: 'transparent',
    borderColor: colors.teal,
  },
  bumpBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.white,
  },
  bumpBtnTextBumped: { color: colors.teal },

  gridPlaceholder: {
    margin: 16,
    height: 200,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridPlaceholderText: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.muted,
  },
});
