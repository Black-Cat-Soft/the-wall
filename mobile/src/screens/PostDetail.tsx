import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Image, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { api, resolveAssetUrl, type Post } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, fonts } from '../lib/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackScreenProps<RootStackParamList, 'PostDetail'>['route'];

export default function PostDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { token } = useAuth();
  const { postId } = route.params;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPost();
  }, [postId]);

  const loadPost = async () => {
    if (!token) return;
    try {
      // Fetch from feed and find the post
      // TODO: Add a dedicated post detail endpoint to the backend
      const feed = await api.posts.feed(token);
      const foundPost = feed.find(p => p.id === postId);
      setPost(foundPost || null);
    } catch (err) {
      console.error('Failed to load post:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!post || !token) return;
    try {
      await api.posts.like(post.id, token);
      // Reload post
      loadPost();
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleProfilePress = () => {
    if (post?.author) {
      nav.navigate('Profile', { userId: post.author.id });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.errorText}>Post not found</Text>
        <Pressable onPress={() => nav.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeIcon}>←</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Post Image */}
        <Image
          source={{ uri: resolveAssetUrl(post.imageUrl) }}
          style={styles.postImage}
          resizeMode="cover"
        />

        {/* Post Info */}
        <View style={styles.content}>
          {/* Author */}
          <Pressable onPress={handleProfilePress} style={styles.authorRow}>
            <Avatar
              username={post.author.username}
              avatar={post.author.avatar}
              size={40}
            />
            <Text style={styles.authorName}>{post.author.username}</Text>
          </Pressable>

          {/* Caption */}
          {post.caption && (
            <View style={styles.captionRow}>
              <Text style={styles.captionAuthor}>{post.author.username}</Text>
              <Text style={styles.caption}>{post.caption}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable onPress={handleLike} style={styles.likeBtn}>
              <Text style={styles.likeIcon}>{post.isLiked ? '♥' : '♡'}</Text>
              <Text style={styles.likeCount}>{post._count} likes</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  closeBtn: {
    padding: 8,
  },
  closeIcon: {
    fontFamily: fonts.mono,
    fontSize: 24,
    color: colors.ink,
  },
  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: colors.border,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorName: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.ink,
  },
  captionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  captionAuthor: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.ink,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.ink,
    flex: 1,
  },
  actions: {
    paddingTop: 8,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likeIcon: {
    fontSize: 24,
    color: colors.red,
  },
  likeCount: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.muted,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.red,
    textAlign: 'center',
    marginTop: 40,
  },
  backBtn: {
    marginTop: 20,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  backText: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.ink,
  },
});
