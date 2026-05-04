import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';

import LoginScreen      from '../screens/Login';
import RegisterScreen   from '../screens/Register';
import FeedScreen       from '../screens/Feed';
import ProfileScreen    from '../screens/Profile';
import BumpScreen       from '../screens/Bump';
import PostDetailScreen from '../screens/PostDetail';

export type RootStackParamList = {
  Login:      undefined;
  Register:   undefined;
  Feed:       undefined;
  Profile:    { userId: number };
  PostDetail: { postId: number };
  Bump:       undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background:   colors.cream,
    card:         colors.yellow,
    text:         colors.ink,
    border:       colors.border,
    primary:      colors.red,
    notification: colors.red,
  },
};

export default function Navigation() {
  const { token, ready } = useAuth();
  if (!ready) return null;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {token ? (
          <>
            <Stack.Screen name="Feed"       component={FeedScreen} />
            <Stack.Screen name="Profile"    component={ProfileScreen} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} />
            <Stack.Screen
              name="Bump"
              component={BumpScreen}
              options={{ animation: 'fade', presentation: 'fullScreenModal' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
