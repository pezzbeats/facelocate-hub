import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { 
  registerServiceWorker, 
  setupPWAInstallPrompt, 
  setupOfflineDetection,
  setupMobileOptimizations 
} from "./utils/pwa";

// PWA Setup Component
const PWASetup = () => {
  useEffect(() => {
    // Initialize PWA features
    const initializePWA = async () => {
      // Register service worker
      await registerServiceWorker();
      
      // Setup PWA install prompt
      const cleanupInstallPrompt = setupPWAInstallPrompt();
      
      // Setup offline detection
      const cleanupOfflineDetection = setupOfflineDetection();
      
      // Setup mobile optimizations
      setupMobileOptimizations();
      
      // Cleanup on unmount
      return () => {
        cleanupInstallPrompt();
        cleanupOfflineDetection();
      };
    };
    
    initializePWA();
  }, []);

  return null;
};

createRoot(document.getElementById("root")!).render(
  <>
    <PWASetup />
    <App />
  </>
);
