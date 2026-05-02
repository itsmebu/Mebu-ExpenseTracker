import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../hooks/useAuth';

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [modalVisible, setModalVisible] = useState(false); // New state for custom modal

  const router = useRouter();
  const { signUp, checkUsernameExists } = useAuth();

  // Validation functions (unchanged)
  const validateFullName = (name: string) => {
    const nameRegex = /^[A-Za-z\s]+$/;
    return nameRegex.test(name);
  };

  const validateUsername = (name: string) => {
    const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
    return usernameRegex.test(name);
  };

  const validatePassword = (pass: string) => {
    return pass.length >= 8;
  };

  const handleFullNameChange = (text: string) => {
    const filteredText = text.replace(/[^A-Za-z\s]/g, '');
    setFullName(filteredText);
  };

  const handleUsernameChange = (text: string) => {
    const filteredText = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(filteredText);
    setUsernameAvailable(null);
  };

  const checkUsername = async () => {
    if (username.length >= 3 && validateUsername(username)) {
      setCheckingUsername(true);
      const exists = await checkUsernameExists(username);
      setUsernameAvailable(!exists);
      setCheckingUsername(false);
    }
  };

  const handleSignup = async () => {
    if (!fullName || !username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateFullName(fullName)) {
      Alert.alert('Error', 'Full name can only contain letters and spaces');
      return;
    }

    if (fullName.trim().length < 2) {
      Alert.alert('Error', 'Full name must be at least 2 characters');
      return;
    }

    if (!validateUsername(username)) {
      Alert.alert(
        'Error',
        'Username must be 3-20 characters and can only contain letters, numbers, and underscore'
      );
      return;
    }

    if (!usernameAvailable) {
      Alert.alert('Error', 'Please check username availability');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await signUp(email, password, fullName, username);
    setLoading(false);

    if (result.success) {
      setModalVisible(true); // Show custom modal instead of Alert
    } else {
      Alert.alert('Signup Failed', result.error);
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    router.push('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#1a472a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: 20 }}>
          <Text
            style={{
              fontSize: 32,
              color: '#ffffff',
              fontFamily: 'Poppins-Bold',
              marginBottom: 30,
              textAlign: 'center',
            }}
          >
            Create Account
          </Text>

          {/* Full Name Input */}
          <View style={{ marginBottom: 15 }}>
            <Text
              style={{
                color: '#90ee90',
                marginBottom: 5,
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
              }}
            >
              Full Name
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#2a5a3a',
                borderRadius: 10,
              }}
            >
              <Icon name="user" size={20} color="#90ee90" style={{ marginLeft: 15 }} />
              <TextInput
                style={{ flex: 1, padding: 15, color: '#ffffff', fontFamily: 'Poppins-Regular' }}
                placeholder="Enter your full name"
                placeholderTextColor="#90ee90"
                value={fullName}
                onChangeText={handleFullNameChange}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Username Input */}
          <View style={{ marginBottom: 15 }}>
            <Text
              style={{
                color: '#90ee90',
                marginBottom: 5,
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
              }}
            >
              Username
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#2a5a3a',
                borderRadius: 10,
              }}
            >
              <Icon name="at-sign" size={20} color="#90ee90" style={{ marginLeft: 15 }} />
              <TextInput
                style={{ flex: 1, padding: 15, color: '#ffffff', fontFamily: 'Poppins-Regular' }}
                placeholder="Enter username (e.g., john_doe123)"
                placeholderTextColor="#90ee90"
                value={username}
                onChangeText={handleUsernameChange}
                onBlur={checkUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {username.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                {checkingUsername ? (
                  <ActivityIndicator size="small" color="#90ee90" />
                ) : usernameAvailable === true ? (
                  <Text style={{ color: '#4ECDC4', fontSize: 10, fontFamily: 'Poppins-Regular' }}>
                    ✓ Username is available
                  </Text>
                ) : usernameAvailable === false ? (
                  <Text style={{ color: '#FF6B6B', fontSize: 10, fontFamily: 'Poppins-Regular' }}>
                    ✗ Username is already taken
                  </Text>
                ) : null}
              </View>
            )}
            <Text
              style={{
                color: '#c0e0c0',
                fontSize: 10,
                marginTop: 5,
                fontFamily: 'Poppins-Regular',
              }}
            >
              Letters, numbers, underscore only (3-20 characters)
            </Text>
          </View>

          {/* Email Input */}
          <View style={{ marginBottom: 15 }}>
            <Text
              style={{
                color: '#90ee90',
                marginBottom: 5,
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
              }}
            >
              Email Address
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#2a5a3a',
                borderRadius: 10,
              }}
            >
              <Icon name="mail" size={20} color="#90ee90" style={{ marginLeft: 15 }} />
              <TextInput
                style={{ flex: 1, padding: 15, color: '#ffffff', fontFamily: 'Poppins-Regular' }}
                placeholder="Enter your email"
                placeholderTextColor="#90ee90"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={{ marginBottom: 15 }}>
            <Text
              style={{
                color: '#90ee90',
                marginBottom: 5,
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
              }}
            >
              Password (Min. 8 Characters)
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#2a5a3a',
                borderRadius: 10,
              }}
            >
              <Icon name="lock" size={20} color="#90ee90" style={{ marginLeft: 15 }} />
              <TextInput
                style={{ flex: 1, padding: 15, color: '#ffffff', fontFamily: 'Poppins-Regular' }}
                placeholder="Create a password"
                placeholderTextColor="#90ee90"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 15 }}>
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color="#90ee90" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                color: '#90ee90',
                marginBottom: 5,
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
              }}
            >
              Confirm Password
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#2a5a3a',
                borderRadius: 10,
              }}
            >
              <Icon name="lock" size={20} color="#90ee90" style={{ marginLeft: 15 }} />
              <TextInput
                style={{ flex: 1, padding: 15, color: '#ffffff', fontFamily: 'Poppins-Regular' }}
                placeholder="Confirm your password"
                placeholderTextColor="#90ee90"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ padding: 15 }}
              >
                <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#90ee90" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={{
              backgroundColor: '#90ee90',
              padding: 15,
              borderRadius: 10,
              alignItems: 'center',
              marginBottom: 20,
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1a472a" />
            ) : (
              <Text
                style={{
                  color: '#1a472a',
                  fontSize: 16,
                  fontWeight: 'bold',
                  fontFamily: 'Poppins-SemiBold',
                }}
              >
                Sign Up
              </Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: '#c0e0c0', fontFamily: 'Poppins-Regular' }}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={{ color: '#90ee90', fontWeight: 'bold', fontFamily: 'Poppins-SemiBold' }}>
                Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Custom Dark Green Minimal Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleModalClose}
      >
        <TouchableWithoutFeedback onPress={handleModalClose}>
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: '#1a472a',
                  borderRadius: 20,
                  padding: 24,
                  width: '80%',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#2a5a3a',
                }}
              >
                <Icon name="mail" size={48} color="#90ee90" style={{ marginBottom: 16 }} />
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 20,
                    fontFamily: 'Poppins-SemiBold',
                    marginBottom: 8,
                    textAlign: 'center',
                  }}
                >
                  Verification Email Sent
                </Text>
                <Text
                  style={{
                    color: '#c0e0c0',
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    textAlign: 'center',
                    marginBottom: 24,
                  }}
                >
                  Please verify your email before logging in. Check your Gmail inbox.
                </Text>
                <TouchableOpacity
                  onPress={handleModalClose}
                  style={{
                    backgroundColor: '#90ee90',
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderRadius: 30,
                    minWidth: 120,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#1a472a',
                      fontSize: 16,
                      fontFamily: 'Poppins-SemiBold',
                    }}
                  >
                    OK
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}