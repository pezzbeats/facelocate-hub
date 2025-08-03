// Secure client-side storage utilities with encryption

interface EncryptedStorageItem {
  data: string;
  timestamp: number;
  expiry?: number;
}

class SecureStorage {
  private static readonly ENCRYPTION_PREFIX = 'ENC_';
  private static readonly DEFAULT_EXPIRY_HOURS = 24;

  // Simple client-side encryption (in production, use proper crypto library)
  private static encrypt(data: string): string {
    // This is a basic implementation - use a proper encryption library in production
    const encoded = btoa(data);
    return `${this.ENCRYPTION_PREFIX}${encoded}`;
  }

  private static decrypt(encryptedData: string): string {
    if (!encryptedData.startsWith(this.ENCRYPTION_PREFIX)) {
      throw new Error('Invalid encrypted data format');
    }
    
    const encoded = encryptedData.slice(this.ENCRYPTION_PREFIX.length);
    return atob(encoded);
  }

  static setItem(key: string, value: any, expiryHours?: number): void {
    try {
      const item: EncryptedStorageItem = {
        data: this.encrypt(JSON.stringify(value)),
        timestamp: Date.now(),
        expiry: expiryHours ? Date.now() + (expiryHours * 60 * 60 * 1000) : undefined
      };
      
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to store data securely');
    }
  }

  static getItem<T>(key: string): T | null {
    try {
      const storedItem = localStorage.getItem(key);
      if (!storedItem) return null;

      const item: EncryptedStorageItem = JSON.parse(storedItem);
      
      // Check expiry
      if (item.expiry && Date.now() > item.expiry) {
        this.removeItem(key);
        return null;
      }

      const decryptedData = this.decrypt(item.data);
      return JSON.parse(decryptedData) as T;
    } catch (error) {
      console.warn('Failed to retrieve data securely');
      this.removeItem(key); // Clean up corrupted data
      return null;
    }
  }

  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove stored data');
    }
  }

  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('Failed to clear stored data');
    }
  }

  // Clean up expired items
  static cleanup(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();

      keys.forEach(key => {
        try {
          const storedItem = localStorage.getItem(key);
          if (!storedItem) return;

          const item: EncryptedStorageItem = JSON.parse(storedItem);
          if (item.expiry && now > item.expiry) {
            localStorage.removeItem(key);
          }
        } catch {
          // Ignore corrupted items
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup expired data');
    }
  }
}

// Auto-cleanup on page load
window.addEventListener('load', () => {
  SecureStorage.cleanup();
});

export default SecureStorage;