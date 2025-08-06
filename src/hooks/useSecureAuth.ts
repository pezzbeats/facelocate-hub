import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LoginCredentials {
  email: string;
  password: string;
}

export const useSecureAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  // Check admin status
  const checkAdminStatus = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('role, is_active')
        .eq('id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Admin check error:', error);
        return false;
      }
      
      const adminStatus = !!data;
      setIsAdmin(adminStatus);
      return adminStatus;
    } catch (error) {
      console.error('Admin check error:', error);
      setIsAdmin(false);
      return false;
    }
  }, []);

  // Login function
  const secureLogin = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || 'Invalid credentials',
        variant: "destructive"
      });
      return { error, data: null };
    }
  }, [toast]);

  // Logout function
  const secureLogout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setSession(null);
      setIsAdmin(false);

      return { error: null };
    } catch (error: any) {
      console.error('Logout error:', error);
      return { error };
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setSession(session);
          setUser(session.user);
          // Defer admin check to avoid blocking
          setTimeout(() => {
            if (mounted) {
              checkAdminStatus(session.user.id);
            }
          }, 0);
        } else {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
        
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        checkAdminStatus(session.user.id);
      } else {
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdminStatus]);

  return {
    user,
    session,
    loading,
    isAdmin,
    secureLogin,
    secureLogout,
    checkAdminStatus
  };
};
