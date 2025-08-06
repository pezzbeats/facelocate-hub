// Secure authentication hook with additional security measures

import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { RateLimiter } from '@/utils/rateLimiter';
import SecureStorage from '@/utils/secureStorage';

interface SecurityEvent {
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'session_expired';
  timestamp: number;
  userAgent: string;
  ipAddress?: string;
}

export const useSecureAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Log security events
  const logSecurityEvent = useCallback((event: Omit<SecurityEvent, 'timestamp' | 'userAgent'>) => {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    // Store security events locally (in production, also send to server)
    const events = SecureStorage.getItem<SecurityEvent[]>('security_events') || [];
    events.push(securityEvent);
    
    // Keep only last 100 events
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    
    SecureStorage.setItem('security_events', events, 24); // 24 hour expiry
  }, []);

  // Check admin status
  const checkAdminStatus = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('role, is_active')
        .eq('id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(!!data);
      return !!data;
    } catch (error) {
      console.error('Admin check error:', error);
      setIsAdmin(false);
      return false;
    }
  }, []);

  // Secure login with rate limiting
  const secureLogin = useCallback(async (email: string, password: string) => {
    const rateLimitKey = `login_${email}`;
    
    // Check rate limit
    if (RateLimiter.isRateLimited(rateLimitKey, 5, 15 * 60 * 1000)) {
      const resetTime = RateLimiter.getResetTime(rateLimitKey);
      const resetMinutes = Math.ceil(resetTime / (60 * 1000));
      throw new Error(`Too many login attempts. Please try again in ${resetMinutes} minute(s).`);
    }

    setLoading(true);
    logSecurityEvent({ type: 'login_attempt' });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        logSecurityEvent({ type: 'login_failure' });
        setLoading(false);
        throw error;
      }

      if (data.user) {
        const isAdminUser = await checkAdminStatus(data.user.id);
        if (!isAdminUser) {
          await supabase.auth.signOut();
          setLoading(false);
          throw new Error('Access denied. Admin privileges required.');
        }

        logSecurityEvent({ type: 'login_success' });
        
        // Store session info securely
        SecureStorage.setItem('last_login', {
          timestamp: Date.now(),
          userId: data.user.id,
          email: data.user.email
        }, 1); // 1 hour expiry
      }

      setLoading(false);
      return data;
    } catch (error) {
      logSecurityEvent({ type: 'login_failure' });
      setLoading(false);
      throw error;
    }
  }, [checkAdminStatus, logSecurityEvent]);

  // Secure logout
  const secureLogout = useCallback(async () => {
    try {
      logSecurityEvent({ type: 'logout' });
      
      // Clear secure storage
      SecureStorage.removeItem('last_login');
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setSession(null);
      setIsAdmin(false);
    } catch (error) {
      console.warn('Logout error:', error);
      // Force clear state even if logout fails
      setUser(null);
      setSession(null);
      setIsAdmin(false);
    }
  }, [logSecurityEvent]);

  // Session validation
  const validateSession = useCallback(async (currentSession: Session) => {
    if (!currentSession?.user) return false;

    try {
      // Check if admin status is still valid
      const isStillAdmin = await checkAdminStatus(currentSession.user.id);
      if (!isStillAdmin) {
        logSecurityEvent({ type: 'session_expired' });
        await secureLogout();
        return false;
      }

      return true;
    } catch (error) {
      logSecurityEvent({ type: 'session_expired' });
      await secureLogout();
      return false;
    }
  }, [checkAdminStatus, logSecurityEvent, secureLogout]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session && mounted) {
          const isValid = await validateSession(session);
          if (isValid) {
            setSession(session);
            setUser(session.user);
            await checkAdminStatus(session.user.id);
          }
        }
      } catch (error) {
        console.warn('Auth initialization error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session) {
          const isValid = await validateSession(session);
          if (isValid) {
            setSession(session);
            setUser(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          const isValid = await validateSession(session);
          if (isValid) {
            setSession(session);
            setUser(session.user);
          }
        }
      }
    );

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [validateSession, checkAdminStatus]);

  // Session timeout check (every 5 minutes)
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      await validateSession(session);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session, validateSession]);

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
