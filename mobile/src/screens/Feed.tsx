import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, StatusBar, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { api, type Post } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../lib/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FeedScreen() {
  const { token, user } = useAuth();
  const nav = useNavigation<Nav>();
  const [posts, setPosts]           = useState<Post[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setPosts(await api.posts.feed(token)); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.yellow} />

      {/* Kodak yellow header */}
      <View style={styles.header}>
        <Text style={styles.logo}>THE WALL</Text>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.tapBtn}
            onPress={() => nav.navigate('Bump')}
            hitSlop={10}
          >
            <Text style={styles.tapBtnText}>BUMP</Text>
          </Pressable>
          <Pressable
            style={styles.avatarBtn}
            onPress={() => user && nav.navigate('Profile', { userId: user.id })}
          >
            <Text style={styles.avatarInitial}>
              {user?.username?.[0].toUpperCase() ?? '?'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* feed */}
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>DEVELOPING…</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => String(p.id)}
          renderItem={({ item, index }) => (
            <View style={styles.postPlaceholder}>
              <Text style={styles.postPlaceholderText}>POST #{index + 1}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>NO FRAMES YET</Text>
              <Text style={styles.emptyBody}>
                Bump someone nearby to connect.{'\n'}Their shots will appear here.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
        />
      )}

      {/* floating shutter */}
      <Pressable
        style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}
        onPress={() => setShowUpload(true)}
      >
        <Text style={styles.shutterIcon}>◉</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },

  header: {
    backgroundColor: colors.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: colors.orange,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 3,
    color: colors.ink,
    lineHeight: 36,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tapBtn: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tapBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.ink,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  avatarInitial: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.white,
    lineHeight: 20,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 3,
    color: colors.muted,
  },

  postPlaceholder: {
    margin: 16,
    height: 300,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postPlaceholderText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.muted,
    letterSpacing: 2,
  },

  empty: { alignItems: 'center', gap: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 2,
    color: colors.ink,
  },
  emptyBody: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },

  shutter: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.red,
    borderWidth: 3,
    borderColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  shutterPressed: { transform: [{ scale: 0.92 }] },
  shutterIcon: {
    fontSize: 30,
    color: colors.white,
    lineHeight: 34,
  },
});
