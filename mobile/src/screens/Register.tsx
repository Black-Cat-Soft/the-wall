import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../lib/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RegisterScreen() {
  const { login } = useAuth();
  const nav = useNavigation<Nav>();
  const [form, setForm]       = useState({ username: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.auth.register(form);
      await login(token, user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.stripe}>
          <Text style={styles.logo}>STRAY</Text>
          <Text style={styles.tagline}>load your film</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="username"
            placeholderTextColor={colors.muted}
            value={form.username}
            onChangeText={set('username')}
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="email"
            placeholderTextColor={colors.muted}
            value={form.email}
            onChangeText={set('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="password"
            placeholderTextColor={colors.muted}
            value={form.password}
            onChangeText={set('password')}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {error !== '' && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'LOADING FILM…' : 'SHOOT'}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => nav.navigate('Login')}>
          <Text style={styles.switchText}>
            already loaded? <Text style={styles.switchLink}>log in</Text>
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page:   { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, justifyContent: 'center', gap: 0 },

  stripe: {
    backgroundColor: colors.yellow,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: colors.orange,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 72,
    letterSpacing: 6,
    color: colors.ink,
    lineHeight: 76,
  },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.ink,
    opacity: 0.6,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: colors.paper,
    padding: 24,
    gap: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.mono,
  },
  error: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.red,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: colors.red,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPressed:  { opacity: 0.8 },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 4,
    color: colors.white,
  },

  switchText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  switchLink: {
    color: colors.red,
    fontFamily: fonts.monoBold,
  },
});
