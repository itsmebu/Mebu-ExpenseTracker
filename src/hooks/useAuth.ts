// hooks/useAuth.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../../config/firebase';

export interface UserProfile {
  fullName: string;
  username: string;
  email: string;
  createdAt: Date;
}

const USER_CACHE_KEY = '@mebu/user_profile';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load cached user data on mount
  useEffect(() => {
    const loadCachedUser = async () => {
      try {
        const cached = await AsyncStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          const userData = JSON.parse(cached);
          setUserProfile(userData);
          console.log('Loaded cached user profile');
        }
      } catch (error) {
        console.error('Error loading cached user:', error);
      }
    };
    loadCachedUser();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);
            // Cache user profile for offline access
            await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(profile));
            await AsyncStorage.setItem('@mebu/user_uid', firebaseUser.uid);
            await AsyncStorage.setItem('@mebu/user_email', firebaseUser.email || '');
          }
        } catch (error) {
          console.error('Error loading user profile (offline):', error);
        }
      } else {
        // Clear cache on logout
        setUserProfile(null);
        await AsyncStorage.removeItem(USER_CACHE_KEY);
        await AsyncStorage.removeItem('@mebu/user_uid');
        await AsyncStorage.removeItem('@mebu/user_email');
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Check if username exists
  const checkUsernameExists = async (username: string): Promise<boolean> => {
    try {
      const usernameRef = doc(db, 'usernames', username.toLowerCase());
      const usernameDoc = await getDoc(usernameRef);
      return usernameDoc.exists();
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  };

  // Sign up with username
  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    try {
      // Check if username already exists
      const usernameExists = await checkUsernameExists(username);
      if (usernameExists) {
        return { success: false, error: 'Username is already taken. Please choose another one.' };
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;
      
      // Update display name in Firebase Auth
      await updateProfile(userCredential.user, { displayName: fullName });
      
      // Save username mapping to usernames collection
      await setDoc(doc(db, 'usernames', username.toLowerCase()), {
        userId: userId,
        username: username.toLowerCase(),
        createdAt: new Date(),
      });
      
      // Save user profile to Firestore
      await setDoc(doc(db, 'users', userId), {
        fullName: fullName,
        username: username.toLowerCase(),
        email: email,
        createdAt: new Date(),
      });
      
      await sendEmailVerification(userCredential.user);
      
      // Cache user data
      await AsyncStorage.setItem('@mebu/user_uid', userId);
      await AsyncStorage.setItem('@mebu/user_email', email);
      
      return { success: true, user: userCredential.user };
    } catch (error: any) {
      let errorMessage = 'Signup failed. ';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else {
        errorMessage += error.message;
      }
      return { success: false, error: errorMessage };
    }
  };

  // Sign in with email/username and password
  const signIn = async (identifier: string, password: string) => {
    try {
      let email = identifier;
      
      // Check if identifier is a username (doesn't contain @)
      if (!identifier.includes('@')) {
        const usernameRef = doc(db, 'usernames', identifier.toLowerCase());
        const usernameDoc = await getDoc(usernameRef);
        
        if (usernameDoc.exists()) {
          const userData = usernameDoc.data();
          const userDoc = await getDoc(doc(db, 'users', userData.userId));
          if (userDoc.exists()) {
            email = userDoc.data().email;
          }
        } else {
          return { success: false, error: 'Invalid username or password.' };
        }
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        return { success: false, error: 'Please verify your email before logging in. Check your inbox for the verification link.' };
      }
      
      // Cache user data
      await AsyncStorage.setItem('@mebu/user_uid', userCredential.user.uid);
      await AsyncStorage.setItem('@mebu/user_email', userCredential.user.email || '');
      
      return { success: true, user: userCredential.user };
    } catch (error: any) {
      let errorMessage = 'Login failed. ';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email/username or password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else {
        errorMessage += error.message;
      }
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem(USER_CACHE_KEY);
      await AsyncStorage.removeItem('@mebu/user_uid');
      await AsyncStorage.removeItem('@mebu/user_email');
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
          await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userDoc.data()));
        }
      } catch (error) {
        console.error('Error refreshing user profile:', error);
      }
    }
  };

  return { 
    user, 
    userProfile, 
    loading, 
    signUp, 
    signIn, 
    logout, 
    checkUsernameExists,
    refreshUserProfile 
  };
};