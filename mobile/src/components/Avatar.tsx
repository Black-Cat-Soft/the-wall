import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { BRANDING } from '../config/branding';

const BASE = BRANDING.API_URL;

interface Props {
  username: string;
  avatar?: string;
  size?: number;
  borderColor?: string;
}

export default function Avatar({ username, avatar, size = 36, borderColor = colors.border }: Props) {
  const initial = username[0].toUpperCase();
  return (
    <View style={[styles.wrap, { width: size, height: size, borderColor }]}>
      {avatar
        ? <Image source={{ uri: BASE + avatar }} style={styles.img} />
        : <Text style={[styles.initial, { fontSize: size * 0.45 }]}>{initial}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  initial: {
    fontFamily: fonts.display,
    color: colors.yellow,
    lineHeight: undefined,
  },
});
