// PWA utilities for offline support and installation

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Service Worker registration
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registration successful:', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              if (confirm('New version available! Reload to update?')) {
                window.location.reload();
              }
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
      return null;
    }
  }
  return null;
};

// PWA installation prompt
export const setupPWAInstallPrompt = (): (() => void) => {
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    
    // Show install button or banner
    showInstallPrompt();
  });
  
  const showInstallPrompt = () => {
    const installBanner = document.createElement('div');
    installBanner.id = 'pwa-install-banner';
    installBanner.className = 'fixed bottom-4 left-4 right-4 bg-primary text-white p-4 rounded-lg shadow-lg z-50 flex items-center justify-between';
    installBanner.innerHTML = `
      <div>
        <h3 class="font-medium">Install JusTrack</h3>
        <p class="text-sm opacity-90">Get the full app experience</p>
      </div>
      <div class="flex gap-2">
        <button id="pwa-install-btn" class="px-4 py-2 bg-white text-primary rounded font-medium">Install</button>
        <button id="pwa-dismiss-btn" class="px-4 py-2 bg-transparent border border-white rounded">Dismiss</button>
      </div>
    `;
    
    document.body.appendChild(installBanner);
    
    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User ${outcome} the install prompt`);
        deferredPrompt = null;
        installBanner.remove();
      }
    });
    
    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
      installBanner.remove();
    });
  };
  
  // Return cleanup function
  return () => {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
  };
};

// Offline detection
export const setupOfflineDetection = (): (() => void) => {
  let offlineBanner: HTMLElement | null = null;
  
  const showOfflineBanner = () => {
    if (offlineBanner) return;
    
    offlineBanner = document.createElement('div');
    offlineBanner.id = 'offline-banner';
    offlineBanner.className = 'fixed top-0 left-0 right-0 bg-warning text-warning-foreground p-2 text-center z-50';
    offlineBanner.innerHTML = '📱 You\'re offline. Some features may be limited.';
    document.body.appendChild(offlineBanner);
  };
  
  const hideOfflineBanner = () => {
    if (offlineBanner) {
      offlineBanner.remove();
      offlineBanner = null;
    }
  };
  
  const handleOnline = () => {
    hideOfflineBanner();
    console.log('App is online');
  };
  
  const handleOffline = () => {
    showOfflineBanner();
    console.log('App is offline');
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Check initial state
  if (!navigator.onLine) {
    showOfflineBanner();
  }
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    hideOfflineBanner();
  };
};

// Background sync for attendance data
export const queueAttendanceForSync = async (attendanceData: any): Promise<void> => {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    try {
      // Store data in IndexedDB or localStorage for sync
      const storedData = localStorage.getItem('pendingAttendance');
      const pendingData = storedData ? JSON.parse(storedData) : [];
      pendingData.push({
        ...attendanceData,
        timestamp: Date.now(),
        id: crypto.randomUUID()
      });
      localStorage.setItem('pendingAttendance', JSON.stringify(pendingData));
      
      // Register background sync
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('attendance-sync');
      
      console.log('Attendance data queued for sync');
    } catch (error) {
      console.error('Failed to queue attendance for sync:', error);
    }
  }
};

// Push notification subscription
export const subscribeToPushNotifications = async (): Promise<PushSubscription | null> => {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(
          'YOUR_VAPID_PUBLIC_KEY' // Replace with actual VAPID key
        )
      });
      
      console.log('Push subscription:', subscription);
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }
  return null;
};

// Helper function for VAPID key conversion
function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Mobile-specific optimizations
export const setupMobileOptimizations = (): void => {
  // Prevent zoom on input focus (iOS)
  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    metaViewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    );
  }
  
  // Wake lock for kiosk mode
  if ('wakeLock' in navigator) {
    let wakeLock: any = null;
    
    const requestWakeLock = async () => {
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('Screen wake lock activated');
      } catch (err) {
        console.error('Failed to activate wake lock:', err);
      }
    };
    
    // Request wake lock when on kiosk page
    if (window.location.pathname === '/kiosk') {
      requestWakeLock();
    }
    
    // Re-request wake lock when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    });
  }
  
  // Disable context menu on long press (mobile)
  document.addEventListener('contextmenu', (e) => {
    if (window.location.pathname === '/kiosk') {
      e.preventDefault();
    }
  });
  
  // Handle orientation changes
  window.addEventListener('orientationchange', () => {
    // Small delay to allow the orientation to fully change
    setTimeout(() => {
      window.location.reload();
    }, 100);
  });
};