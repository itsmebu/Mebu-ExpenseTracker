// app/(tabs)/profile.tsx

import { useRouter } from 'expo-router';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { db } from '../../../config/firebase';
import { useAuth } from '../../hooks/useAuth';

const { height } = require('react-native').Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userProfile, logout, refreshUserProfile } = useAuth();
  
  // Refresh State
  const [refreshing, setRefreshing] = useState(false);
  
  // Edit Username States
  const [showEditUsernameModal, setShowEditUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [updatingUsername, setUpdatingUsername] = useState(false);
  
  // Change Password States
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  // Settings States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showNotificationSettingsModal, setShowNotificationSettingsModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  
  // Help Center & FAQ States
  const [showHelpCenterModal, setShowHelpCenterModal] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [showContactSupportModal, setShowContactSupportModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sendingContact, setSendingContact] = useState(false);
  
  // Success/Error Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isError, setIsError] = useState(false);
  
  // About Modal
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  // Logout Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // FAQ Data
  const faqData = [
    {
      question: "How do I add an expense?",
      answer: "Tap the green + button in the center of the bottom tab bar, then fill in the expense details."
    },
    {
      question: "How do I mark a bill as paid?",
      answer: "Go to the PAYMENTS tab, find the bill you want to pay, and tap 'Mark Paid'."
    },
    {
      question: "How do I edit or delete an expense?",
      answer: "In the Recent Activity section, swipe left on an item or tap the edit/delete icons."
    },
    {
      question: "How do I change my password?",
      answer: "Go to Profile → Account Settings → Change Password."
    },
    {
      question: "How do I delete my account?",
      answer: "Go to Profile → Settings → Delete Account. This action is permanent and cannot be undone."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, all your data is stored securely in Firebase and protected by your account credentials."
    }
  ];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshUserProfile();
    setRefreshing(false);
  }, [refreshUserProfile]);

  const showModalMessage = (message: string, error: boolean = false) => {
    setSuccessMessage(message);
    setIsError(error);
    setShowSuccessModal(true);
    setTimeout(() => {
      setShowSuccessModal(false);
    }, 2000);
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    const result = await logout();
    if (result.success) {
      router.replace('/(auth)/login');
    } else {
      showModalMessage(result.error, true);
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      showModalMessage('Please enter a username', true);
      return;
    }

    if (newUsername.length < 3) {
      showModalMessage('Username must be at least 3 characters', true);
      return;
    }

    const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
    if (!usernameRegex.test(newUsername)) {
      showModalMessage('Username can only contain letters, numbers, and underscore', true);
      return;
    }

    setUpdatingUsername(true);
    try {
      const oldUsername = userProfile?.username;
      const userId = user!.uid;
      const newUsernameLower = newUsername.toLowerCase();
      
      const existingUsernameDoc = await getDoc(doc(db, 'usernames', newUsernameLower));
      if (existingUsernameDoc.exists() && oldUsername !== newUsernameLower) {
        showModalMessage('Username already taken. Please choose another one.', true);
        setUpdatingUsername(false);
        return;
      }
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        username: newUsernameLower
      });
      
      if (oldUsername && oldUsername !== newUsernameLower) {
        const oldUsernameRef = doc(db, 'usernames', oldUsername.toLowerCase());
        const oldDoc = await getDoc(oldUsernameRef);
        if (oldDoc.exists()) {
          await deleteDoc(oldUsernameRef);
        }
      }
      
      await setDoc(doc(db, 'usernames', newUsernameLower), {
        userId: userId,
        username: newUsernameLower,
        createdAt: new Date(),
      });
      
      showModalMessage('Username updated successfully');
      setShowEditUsernameModal(false);
      setNewUsername('');
      await refreshUserProfile();
    } catch (error: any) {
      console.error('Update username error:', error);
      if (error.code === 'permission-denied') {
        showModalMessage('Permission denied. Please check your Firestore rules.', true);
      } else {
        showModalMessage(error.message || 'Failed to update username', true);
      }
    } finally {
      setUpdatingUsername(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showModalMessage('Please fill in all fields', true);
      return;
    }

    if (newPassword.length < 8) {
      showModalMessage('New password must be at least 8 characters', true);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showModalMessage('New passwords do not match', true);
      return;
    }

    setUpdatingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user!.email!, currentPassword);
      await reauthenticateWithCredential(user!, credential);
      await updatePassword(user!, newPassword);
      
      showModalMessage('Password changed successfully');
      setShowChangePasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        showModalMessage('Current password is incorrect', true);
      } else {
        showModalMessage(error.message, true);
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showModalMessage('Please type DELETE to confirm', true);
      return;
    }

    setDeletingAccount(true);
    try {
      const userId = user!.uid;
      
      // Delete user data from Firestore collections
      const collections = ['expenses', 'shoppingList', 'pendingExpenses', 'categories', 'usernames'];
      
      for (const collectionName of collections) {
        const q = query(collection(db, collectionName), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        if (!snapshot.empty) {
          await batch.commit();
        }
      }
      
      // Delete username document
      if (userProfile?.username) {
        const usernameRef = doc(db, 'usernames', userProfile.username.toLowerCase());
        await deleteDoc(usernameRef);
      }
      
      // Delete user document
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
      
      // Delete Firebase Auth user
      await deleteUser(user!);
      
      // Logout
      await logout();
      router.replace('/(auth)/login');
      showModalMessage('Account deleted successfully');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        showModalMessage('Please log out and log back in before deleting your account', true);
      } else {
        showModalMessage(error.message || 'Failed to delete account', true);
      }
    } finally {
      setDeletingAccount(false);
      setShowDeleteAccountModal(false);
      setDeleteConfirmText('');
    }
  };

  const handleContactSupport = async () => {
    if (!contactSubject.trim()) {
      showModalMessage('Please enter a subject', true);
      return;
    }
    if (!contactMessage.trim()) {
      showModalMessage('Please enter your message', true);
      return;
    }

    setSendingContact(true);
    setTimeout(() => {
      setSendingContact(false);
      setShowContactSupportModal(false);
      setContactSubject('');
      setContactMessage('');
      showModalMessage('Support request sent successfully! We will respond within 24 hours.');
    }, 1500);
  };

  const getDisplayName = () => {
    if (userProfile?.username) {
      return userProfile.username;
    }
    if (userProfile?.fullName) {
      return userProfile.fullName;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  const MenuItem = ({ icon, title, subtitle, onPress, showArrow = true, danger = false }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#2a5a3a'
      }}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2a5a3a',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
      }}>
        <Icon name={icon} size={20} color={danger ? '#ff6b6b' : '#90ee90'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? '#ff6b6b' : '#ffffff', fontSize: 16, fontFamily: 'Poppins-SemiBold' }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {showArrow && (
        <Icon name="chevron-right" size={20} color={danger ? '#ff6b6b' : '#90ee90'} />
      )}
    </TouchableOpacity>
  );

  // Sticky Header Component
  const StickyHeader = () => (
    <View style={{ padding: 20, paddingTop: 40 }}>
      <View style={{ alignItems: 'center', marginBottom: 30 }}>
        <View style={{
          width: 100,
          height: 100,
          backgroundColor: '#2a5a3a',
          borderRadius: 50,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 15
        }}>
          <Icon name="user" size={50} color="#90ee90" />
        </View>
        <Text style={{ color: '#ffffff', fontSize: 28, fontFamily: 'Poppins-Bold' }}>
          @{getDisplayName()}
        </Text>
        <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-Regular', marginTop: 5 }}>
          {user?.email}
        </Text>
        <TouchableOpacity 
          onPress={() => setShowEditUsernameModal(true)}
          style={{ marginTop: 10 }}
        >
          <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
            Edit Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Scrollable Content Component
  const ScrollableContent = () => (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Account Information Section */}
      <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
        Account Information
      </Text>
      <View style={{
        backgroundColor: '#1a472a',
        borderRadius: 15,
        marginBottom: 25,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#2a5a3a'
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 15,
          borderBottomWidth: 1,
          borderBottomColor: '#2a5a3a'
        }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#2a5a3a',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 15
          }}>
            <Icon name="user" size={20} color="#90ee90" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-Regular' }}>Username</Text>
            <Text style={{ color: '#90ee90', fontSize: 16, fontFamily: 'Poppins-SemiBold', marginTop: 2 }}>
              @{getDisplayName()}
            </Text>
          </View>
        </View>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 15,
          borderBottomWidth: 1,
          borderBottomColor: '#2a5a3a'
        }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#2a5a3a',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 15
          }}>
            <Icon name="mail" size={20} color="#90ee90" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-Regular' }}>Email</Text>
            <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-Regular', marginTop: 2 }}>
              {user?.email}
            </Text>
          </View>
        </View>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 15
        }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#2a5a3a',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 15
          }}>
            <Icon name="check-circle" size={20} color={user?.emailVerified ? '#4ECDC4' : '#ff6b6b'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-Regular' }}>Email Verification</Text>
            <Text style={{ color: user?.emailVerified ? '#4ECDC4' : '#ff6b6b', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginTop: 2 }}>
              {user?.emailVerified ? 'Verified' : 'Not Verified'}
            </Text>
          </View>
        </View>
      </View>

      {/* Settings Section - NEW */}
      <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
        Settings
      </Text>
      <View style={{
        backgroundColor: '#1a472a',
        borderRadius: 15,
        marginBottom: 25,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#2a5a3a'
      }}>
        <MenuItem 
          icon="trash-2" 
          title="Delete Account" 
          subtitle="Permanently delete your account and data"
          onPress={() => setShowDeleteAccountModal(true)}
          danger={true}
        />
      </View>

      {/* Account Settings Section */}
      <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
        Security
      </Text>
      <View style={{
        backgroundColor: '#1a472a',
        borderRadius: 15,
        marginBottom: 25,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#2a5a3a'
      }}>
        <MenuItem 
          icon="lock" 
          title="Change Password" 
          subtitle="Update your password"
          onPress={() => setShowChangePasswordModal(true)}
        />
      </View>

      {/* Support Section */}
      <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
        Support
      </Text>
      <View style={{
        backgroundColor: '#1a472a',
        borderRadius: 15,
        marginBottom: 25,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#2a5a3a'
      }}>
        <MenuItem 
          icon="help-circle" 
          title="Help Center" 
          subtitle="Get help and tutorials"
          onPress={() => setShowHelpCenterModal(true)}
        />
        <MenuItem 
          icon="message-circle" 
          title="FAQ" 
          subtitle="Frequently asked questions"
          onPress={() => setShowFAQModal(true)}
        />
        <MenuItem 
          icon="file-text" 
          title="Privacy Policy" 
          subtitle="How we protect your data"
          onPress={() => setShowPrivacyPolicyModal(true)}
        />
      </View>

      {/* About Section */}
      <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
        About
      </Text>
      <View style={{
        backgroundColor: '#1a472a',
        borderRadius: 15,
        marginBottom: 25,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#2a5a3a'
      }}>
        <MenuItem 
          icon="info" 
          title="About MEBU" 
          subtitle="Version 3.0.0"
          onPress={() => setShowAboutModal(true)}
        />
      </View>

      {/* Logout Button */}
      <MenuItem 
        icon="log-out" 
        title="Logout" 
        showArrow={false}
        danger={true}
        onPress={() => setShowLogoutModal(true)}
      />
    </View>
  );

  // FAQ Item Component
  const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
    const [expanded, setExpanded] = useState(false);
    return (
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#2a5a3a',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-SemiBold', flex: 1 }}>
            {question}
          </Text>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#90ee90" />
        </View>
        {expanded && (
          <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', marginTop: 8, lineHeight: 18 }}>
            {answer}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a472a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1a472a" />
      
      <View style={{ flex: 1 }}>
        <StickyHeader />

        <FlatList
          data={[{ key: 'content' }]}
          renderItem={() => <ScrollableContent />}
          keyExtractor={() => 'content'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#90ee90"
              colors={['#90ee90']}
            />
          }
        />
      </View>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '100%',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                Preferences
              </Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Icon name="x" size={24} color="#90ee90" />
              </TouchableOpacity>
            </View>
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Theme
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity style={{
                flex: 1,
                backgroundColor: '#2a5a3a',
                padding: 10,
                borderRadius: 10,
                alignItems: 'center',
              }}>
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Dark (Default)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{
                flex: 1,
                backgroundColor: '#2a5a3a',
                padding: 10,
                borderRadius: 10,
                alignItems: 'center',
                opacity: 0.5,
              }}>
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Light (Soon)</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Currency
            </Text>
            <TouchableOpacity style={{
              backgroundColor: '#2a5a3a',
              padding: 12,
              borderRadius: 10,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Philippine Peso (PHP)</Text>
              <Icon name="check" size={20} color="#90ee90" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={{
                backgroundColor: '#90ee90',
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 10,
              }}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal
        visible={showNotificationSettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotificationSettingsModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '100%',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                Notifications
              </Text>
              <TouchableOpacity onPress={() => setShowNotificationSettingsModal(false)}>
                <Icon name="x" size={24} color="#90ee90" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              onPress={() => setNotificationsEnabled(!notificationsEnabled)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 15,
                borderBottomWidth: 1,
                borderBottomColor: '#2a5a3a',
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Poppins-Regular' }}>
                Push Notifications
              </Text>
              <View style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                backgroundColor: notificationsEnabled ? '#4ECDC4' : '#3a6a4a',
                padding: 2,
              }}>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#ffffff',
                  transform: [{ translateX: notificationsEnabled ? 24 : 0 }],
                }} />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setEmailNotifications(!emailNotifications)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 15,
                borderBottomWidth: 1,
                borderBottomColor: '#2a5a3a',
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Poppins-Regular' }}>
                Email Notifications
              </Text>
              <View style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                backgroundColor: emailNotifications ? '#4ECDC4' : '#3a6a4a',
                padding: 2,
              }}>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#ffffff',
                  transform: [{ translateX: emailNotifications ? 24 : 0 }],
                }} />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={{
                backgroundColor: '#90ee90',
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 20,
              }}
              onPress={() => setShowNotificationSettingsModal(false)}
            >
              <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccountModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '100%',
            borderWidth: 1,
            borderColor: '#ff6b6b',
          }}>
            <View style={{ alignItems: 'center', marginBottom: 15 }}>
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#3a1a1a',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Icon name="alert-triangle" size={30} color="#ff6b6b" />
              </View>
              <Text style={{ color: '#ff6b6b', fontSize: 20, fontFamily: 'Poppins-Bold', marginTop: 10 }}>
                Delete Account
              </Text>
            </View>
            
            <Text style={{ color: '#c0e0c0', fontSize: 13, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 15 }}>
              This action is permanent and cannot be undone. All your data will be permanently deleted.
            </Text>
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Type "DELETE" to confirm
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 12,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 20,
                fontFamily: 'Poppins-Regular',
                borderWidth: 1,
                borderColor: '#4a8a6a',
              }}
              placeholder="DELETE"
              placeholderTextColor="#90ee90"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
            />
            
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#ff6b6b',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontFamily: 'Poppins-SemiBold' }}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Help Center Modal */}
      <Modal
        visible={showHelpCenterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHelpCenterModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '100%',
            maxHeight: '80%',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                Help Center
              </Text>
              <TouchableOpacity onPress={() => setShowHelpCenterModal(false)}>
                <Icon name="x" size={24} color="#90ee90" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
                Quick Tips
              </Text>
              
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 5 }}>
                   Getting Started
                </Text>
                <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', lineHeight: 18 }}>
                  Tap the green + button to add expenses. Track your shopping list, pending bills all in one place.
                </Text>
              </View>
              
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 5 }}>
                   Pending Bills & Debts
                </Text>
                <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', lineHeight: 18 }}>
                  Track your bills and debts separately. Mark them as paid when settled, and they'll be added to your expenses.
                </Text>
              </View>
              
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 5 }}>
                   Statistics
                </Text>
                <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', lineHeight: 18 }}>
                  View your spending distribution with the donut chart, daily spending trends, and category breakdowns.
                </Text>
              </View>
            </ScrollView>
            
            <TouchableOpacity
              style={{
                backgroundColor: '#90ee90',
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 20,
              }}
              onPress={() => setShowHelpCenterModal(false)}
            >
              <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        visible={showFAQModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFAQModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '100%',
            maxHeight: '80%',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                Frequently Asked Questions
              </Text>
              <TouchableOpacity onPress={() => setShowFAQModal(false)}>
                <Icon name="x" size={24} color="#90ee90" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={faqData}
              renderItem={({ item }) => <FAQItem question={item.question} answer={item.answer} />}
              keyExtractor={(item, index) => index.toString()}
              showsVerticalScrollIndicator={false}
            />
            
            <TouchableOpacity
              style={{
                backgroundColor: '#90ee90',
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 20,
              }}
              onPress={() => setShowFAQModal(false)}
            >
              <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacyPolicyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPrivacyPolicyModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '100%',
            maxHeight: '80%',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                Privacy Policy
              </Text>
              <TouchableOpacity onPress={() => setShowPrivacyPolicyModal(false)}>
                <Icon name="x" size={24} color="#90ee90" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
                Data Collection
              </Text>
              <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 15, lineHeight: 18 }}>
                We collect your email address, username, and financial transactions you enter into the app. All data is stored securely in Firebase and is only accessible by you.
              </Text>
              
              <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
                Data Usage
              </Text>
              <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 15, lineHeight: 18 }}>
                Your data is used solely to provide expense tracking functionality within the app. We do not share your data with third parties.
              </Text>
              
              <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
                Data Security
              </Text>
              <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 15, lineHeight: 18 }}>
                Your account is protected by Firebase Authentication. Your data is encrypted in transit and at rest.
              </Text>
              
              <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 10 }}>
                Your Rights
              </Text>
              <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 15, lineHeight: 18 }}>
                You can delete your account and all associated data at any time through the profile settings.
              </Text>
            </ScrollView>
            
            <TouchableOpacity
              style={{
                backgroundColor: '#90ee90',
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 20,
              }}
              onPress={() => setShowPrivacyPolicyModal(false)}
            >
              <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Support Modal */}
      <Modal
        visible={showContactSupportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContactSupportModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '100%',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                Contact Support
              </Text>
              <TouchableOpacity onPress={() => setShowContactSupportModal(false)}>
                <Icon name="x" size={24} color="#90ee90" />
              </TouchableOpacity>
            </View>
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Subject *
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 12,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 15,
                fontFamily: 'Poppins-Regular',
              }}
              placeholder="What is your issue about?"
              placeholderTextColor="#90ee90"
              value={contactSubject}
              onChangeText={setContactSubject}
            />
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Message *
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 12,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 15,
                fontFamily: 'Poppins-Regular',
                height: 100,
                textAlignVertical: 'top',
              }}
              placeholder="Please describe your issue in detail..."
              placeholderTextColor="#90ee90"
              value={contactMessage}
              onChangeText={setContactMessage}
              multiline
            />
            
            <Text style={{ color: '#c0e0c0', fontSize: 10, fontFamily: 'Poppins-Regular', marginBottom: 15 }}>
              Our support team will respond within 24 hours.
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={() => setShowContactSupportModal(false)}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#90ee90',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleContactSupport}
                disabled={sendingContact}
              >
                {sendingContact ? (
                  <ActivityIndicator color="#1a472a" />
                ) : (
                  <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success/Error Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '85%',
            maxWidth: 280,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: isError ? '#3a1a1a' : '#4ECDC4',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Icon 
                name={isError ? 'alert-triangle' : 'check'} 
                size={28} 
                color={isError ? '#ff6b6b' : '#1a472a'} 
              />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold', marginBottom: 6, textAlign: 'center' }}>
              {isError ? 'Error' : 'Success!'}
            </Text>
            <Text style={{ color: '#c0e0c0', fontSize: 13, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 15 }}>
              {successMessage}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Edit Username Modal */}
      <Modal
        visible={showEditUsernameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditUsernameModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 15,
            width: '100%',
            borderWidth: 1,
            borderColor: '#4a8a6a'
          }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 15 }}>
              Edit Username
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 15,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 15,
                fontFamily: 'Poppins-Regular'
              }}
              placeholder="New username"
              placeholderTextColor="#90ee90"
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={{ color: '#c0e0c0', fontSize: 10, marginBottom: 15, fontFamily: 'Poppins-Regular' }}>
              Letters, numbers, underscore only (3-20 characters)
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={() => setShowEditUsernameModal(false)}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#90ee90',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={handleUpdateUsername}
                disabled={updatingUsername}
              >
                {updatingUsername ? (
                  <ActivityIndicator color="#1a472a" />
                ) : (
                  <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 15,
            width: '100%',
            borderWidth: 1,
            borderColor: '#4a8a6a'
          }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 15 }}>
              Change Password
            </Text>
            
            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
              Current Password
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a5a3a', borderRadius: 10, marginBottom: 15 }}>
              <TextInput
                style={{ flex: 1, padding: 15, color: '#ffffff', fontFamily: 'Poppins-Regular' }}
                placeholder="Enter current password"
                placeholderTextColor="#90ee90"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 15 }}>
                <Icon name={showCurrentPassword ? 'eye-off' : 'eye'} size={20} color="#90ee90" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
              New Password (Min. 8 characters)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a5a3a', borderRadius: 10, marginBottom: 15 }}>
              <TextInput
                style={{ flex: 1, padding: 15, color: '#ffffff', fontFamily: 'Poppins-Regular' }}
                placeholder="Enter new password"
                placeholderTextColor="#90ee90"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 15 }}>
                <Icon name={showNewPassword ? 'eye-off' : 'eye'} size={20} color="#90ee90" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
              Confirm New Password
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a5a3a', borderRadius: 10, marginBottom: 20 }}>
              <TextInput
                style={{ flex: 1, padding: 15, color: '#ffffff', fontFamily: 'Poppins-Regular' }}
                placeholder="Confirm new password"
                placeholderTextColor="#90ee90"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 15 }}>
                <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#90ee90" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={() => setShowChangePasswordModal(false)}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#90ee90',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={handleChangePassword}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator color="#1a472a" />
                ) : (
                  <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 25,
            borderRadius: 15,
            width: '100%',
            borderWidth: 1,
            borderColor: '#4a8a6a',
            alignItems: 'center'
          }}>
            <View style={{
              width: 80,
              height: 80,
              backgroundColor: '#2a5a3a',
              borderRadius: 40,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <Icon name="trending-up" size={40} color="#90ee90" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 28, fontFamily: 'Poppins-Bold', marginBottom: 5 }}>
              MEBU
            </Text>
            <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-Regular', marginBottom: 20 }}>
              Expense Tracker
            </Text>
            <Text style={{ color: '#c0e0c0', fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 10 }}>
              Version 3.0.0
            </Text>
            <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 20 }}>
              2026 MEBU | Developed by JP-Parilla
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#90ee90',
                padding: 12,
                borderRadius: 10,
                width: '100%',
                alignItems: 'center'
              }}
              onPress={() => setShowAboutModal(false)}
            >
              <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '80%',
            maxWidth: 280,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: '#2a5a3a',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12
            }}>
              <Icon name="log-out" size={28} color="#ff6b6b" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold', marginBottom: 6, textAlign: 'center' }}>
              Logout
            </Text>
            <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 20 }}>
              Are you sure you want to logout?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#4a8a6a',
                }}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#ff6b6b',
                  padding: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleLogout}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-SemiBold', fontSize: 14 }}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}