import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export const TIER_POINTS = {
  free: 0,
  premium: 1000,
  professional: 5000,
  elite: 10000
};

interface Profile {
  id: string;
  name: string;
  email: string;
  account_type: 'creator' | 'member';
  tier: 'free' | 'premium' | 'professional' | 'elite';
  loyalty_points: number;
  avatar_url: string | null;
  bio: string | null;
  joined_date: string;
  last_login: string;
}

interface SignUpData {
  name: string;
  email: string;
  password: string;
  accountType: 'creator' | 'member';
}

interface AuthContextType {
  user: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,name,email,account_type,tier,loyalty_points,avatar_url,bio,joined_date,last_login')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const updateLastLogin = async (userId: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (mounted) {
          if (currentSession?.user) {
            const profile = await fetchProfile(currentSession.user.id);
            setUser(profile);
            setSession(currentSession);
            await updateLastLogin(currentSession.user.id);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        (async () => {
          if (mounted) {
            setSession(newSession);

            if (newSession?.user) {
              const profile = await fetchProfile(newSession.user.id);
              setUser(profile);
              if (event === 'SIGNED_IN') {
                await updateLastLogin(newSession.user.id);
              }
            } else {
              setUser(null);
            }

            setLoading(false);
          }
        })();
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (data: SignUpData) => {
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            account_type: data.accountType
          }
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        await supabase
          .from('profiles')
          .update({
            account_type: data.accountType,
            name: data.name
          })
          .eq('id', authData.user.id);

        const profile = await fetchProfile(authData.user.id);
        setUser(profile);
      }
    } catch (error: any) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        const profile = await fetchProfile(data.user.id);
        setUser(profile);
        await updateLastLogin(data.user.id);
      }
    } catch (error: any) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      const updatedProfile = await fetchProfile(user.id);
      setUser(updatedProfile);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
