import { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { api, resolveAssetUrl, type Post } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { colors, fonts } from '../lib/theme';
const SCREEN_W = Dimensions.get('window').width;
const SPROCKET_COUNT = 7;
const sprockets = Array.from({ length: SPROCKET_COUNT });

function timeAgo(value: string | number) {
  const timestamp = typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : value;
  const secs = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PostCard({ post, currentUserId, index }: {
  post: Post;
  currentUserId: number;
  index: number;
}) {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const initialLiked = post.isLiked;
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(post._count);

  const handleLike = async () => {
    if (!token) return;
    const prev = { liked, count };
    const next = !liked;
    setLiked(next);
    setCount(c => next ? c + 1 : c - 1);
    await Haptics.impactAsync(next
      ? Haptics.ImpactFeedbackStyle.Light
      : Haptics.ImpactFeedbackStyle.Soft);
    try {
      await api.posts.like(post.id, token);
    } catch {
      setLiked(prev.liked);
      setCount(prev.count);
    }
  };

  const frame = String(index + 1).padStart(2, '0');

  return (
    <View style={styles.card}>
      {/* sprocket top — film strip effect */}
      <View style={styles.sprocketRow}>
        {sprockets.map((_, i) => <View key={i} style={styles.sprocket} />)}
      </View>

      <View style={styles.body}>
        {/* header */}
        <Pressable
          style={styles.header}
          onPress={() => nav.navigate('Profile', { userId: post.author.id })}
        >
          <Avatar username={post.author.username} avatar={post.author.avatar} size={34} />
          <Text style={styles.username}>{post.author.username}</Text>
          <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
        </Pressable>

        {/* photo */}
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: resolveAssetUrl(post.imageUrl) }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>

        {/* footer */}
        <View style={styles.footer}>
          <Pressable style={styles.likeBtn} onPress={handleLike} hitSlop={12}>
            <Text style={[styles.heart, liked && styles.heartLiked]}>
              {liked ? '♥' : '♡'}
            </Text>
            {count > 0 && (
              <Text style={[styles.likeCount, liked && styles.heartLiked]}>{count}</Text>
            )}
          </Pressable>

          {post.caption !== '' && (
            <Text style={styles.caption} numberOfLines={3}>
              <Text style={styles.captionUser}>{post.author.username}  </Text>
              {post.caption}
            </Text>
          )}
        </View>
      </View>

      {/* sprocket bottom */}
      <View style={styles.sprocketRow}>
        {sprockets.map((_, i) => <View key={i} style={styles.sprocket} />)}
      </View>

      <Text style={styles.frameNum}>{frame}▲</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 2,
    position: 'relative',
  },
  sprocketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sprocket: {
    width: 14,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.muted,
    opacity: 0.5,
  },
  body: {
    backgroundColor: colors.paper,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  username: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 1,
    color: colors.ink,
    flex: 1,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.3,
  },
  imageWrap: {
    width: SCREEN_W,
    height: SCREEN_W,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 5,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  heart: {
    fontSize: 22,
    color: colors.muted,
    lineHeight: 26,
  },
  heartLiked: {
    color: colors.red,
  },
  likeCount: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 18,
  },
  captionUser: {
    fontFamily: fonts.monoBold,
    color: colors.orange,
  },
  frameNum: {
    position: 'absolute',
    top: 14,
    right: 18,
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.orange,
    opacity: 0.45,
    letterSpacing: 1,
  },
});
