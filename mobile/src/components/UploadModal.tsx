import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, Image,
  Modal, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../lib/theme';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ onClose, onSuccess }: Props) {
  const { token } = useAuth();
  const [uri, setUri]         = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError('Camera permission required'); return; }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!uri || !token) return;
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      const filename = uri.split('/').pop() ?? 'photo.jpg';
      const match    = /\.(\w+)$/.exec(filename);
      const type     = match ? `image/${match[1]}` : 'image/jpeg';
      // @ts-expect-error — RN FormData accepts uri objects
      form.append('image', { uri, name: filename, type });
      form.append('caption', caption);
      await api.posts.create(form, token);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>NEW SHOT</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            {!uri ? (
              <View style={styles.pickRow}>
                <Pressable style={styles.pickBtn} onPress={takePhoto}>
                  <Text style={styles.pickBtnText}>CAMERA</Text>
                </Pressable>
                <Pressable style={[styles.pickBtn, styles.pickBtnSecondary]} onPress={pickImage}>
                  <Text style={[styles.pickBtnText, { color: colors.orange }]}>LIBRARY</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
                <Pressable onPress={() => setUri(null)}>
                  <Text style={styles.reloadFilm}>← reload film</Text>
                </Pressable>
              </>
            )}

            <TextInput
              style={styles.captionInput}
              placeholder="caption…"
              placeholderTextColor={colors.muted}
              value={caption}
              onChangeText={setCaption}
              multiline
              numberOfLines={2}
            />

            {error !== '' && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [styles.submitBtn, (!uri || loading) && styles.submitDisabled, pressed && { opacity: 0.8 }]}
              onPress={handleSubmit}
              disabled={!uri || loading}
            >
              <Text style={styles.submitText}>{loading ? 'DEVELOPING…' : 'DEVELOP'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,15,0,0.7)',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 3,
    borderTopColor: colors.orange,
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.ink,
  },
  closeBtn: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.muted,
    padding: 4,
  },
  body: {
    padding: 18,
    gap: 12,
  },
  pickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickBtn: {
    flex: 1,
    backgroundColor: colors.red,
    borderRadius: 5,
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.orange,
  },
  pickBtnSecondary: {
    backgroundColor: 'transparent',
    borderColor: colors.orange,
  },
  pickBtnText: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.white,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  reloadFilm: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  captionInput: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.ink,
    fontFamily: fonts.mono,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  error: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.red,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: colors.red,
    borderRadius: 5,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 3,
    color: colors.white,
  },
});
