import { useState, useEffect, useCallback, memo, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMediaQuery, useIsMobile } from "@/hooks/useMediaQuery";
import { useAsyncOperation } from "@/hooks/useErrorHandling";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { FaceRecognitionService } from "@/services/FaceRecognitionService";
import { 
  Camera, 
  MapPin, 
  Clock, 
  User, 
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut,
  Coffee,
  Utensils,
  Timer,
  AlertTriangle,
  Volume2,
  VolumeX,
  RefreshCw,
  Wifi,
  WifiOff,
  Settings
} from "lucide-react";
import jusTrackLogo from "@/assets/justrack-logo.png";

interface KioskState {
  status: 'loading' | 'standby' | 'detecting' | 'recognizing' | 'confirming' | 'processing' | 'success' | 'error' | 'temp_exit_request' | 'break_request' | 'temp_exit_status' | 'break_return' | 'temp_exit_reasons' | 'temp_exit_duration' | 'break_types' | 'temp_exit_pending' | 'temp_exit_approved' | 'temp_exit_denied';
  currentEmployee: any | null;
  attendanceAction: any | null;
  errorMessage: string | null;
  countdown: number;
  employeeStatus: any | null;
  pendingRequest: any | null;
  tempExitRequest: any | null;
  selectedBreakType: string | null;
  selectedTempExitReason: string | null;
  selectedDuration: number | null;
}

interface DeviceInfo {
  id: string;
  device_name: string;
  device_code: string;
  location_id: string;
  location_name: string;
}

const KioskInterface = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { execute: executeAsync, loading: asyncLoading } = useAsyncOperation();

  const deviceCode = searchParams.get('device') || localStorage.getItem('deviceCode');
  const faceRecognition = useMemo(() => new FaceRecognitionService(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<any>(null);
  const [attendanceAction, setAttendanceAction] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [faceDetectionActive, setFaceDetectionActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date>(new Date());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [kioskState, setKioskState] = useState<KioskState['status']>('standby');
  const [tempExitRequest, setTempExitRequest] = useState<any>(null);
  const [selectedBreakType, setSelectedBreakType] = useState<string | null>(null);
  const [selectedTempExitReason, setSelectedTempExitReason] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<any>(null);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Time update effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh and heartbeat
  useEffect(() => {
    const heartbeatInterval = setInterval(sendHeartbeat, 30000); // Every 30 seconds
    const refreshInterval = setInterval(() => {
      if (document.hidden) return; // Don't refresh when tab is hidden
      
      // Auto-refresh the interface every 5 minutes if idle
      const now = new Date();
      if (now.getTime() - lastHeartbeat.getTime() > 300000 && !currentEmployee && !isProcessing) {
        window.location.reload();
      }
    }, 60000); // Check every minute

    setAutoRefreshInterval(refreshInterval);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(refreshInterval);
    };
  }, [lastHeartbeat, currentEmployee, isProcessing]);

  // Initialize kiosk
  useEffect(() => {
    initializeKiosk().finally(() => setIsLoading(false));
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initializeKiosk = async () => {
    try {
      // Check device registration
      await checkDeviceRegistration();
      
      // Load face recognition models
      try {
        await faceRecognition.loadModels();
        await faceRecognition.loadEmployeeDescriptors();
      } catch (modelError) {
        console.warn('Face recognition models failed to load, using fallback mode:', modelError);
        toast({
          title: "Limited Functionality",
          description: "Face recognition disabled. Using manual mode.",
          variant: "destructive"
        });
      }
      
      // Initialize camera
      await initializeCamera();
      
    } catch (error: any) {
      setError(error.message);
    }
  };

  const checkDeviceRegistration = async () => {
    // Generate device fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    const deviceId = btoa(fingerprint).substring(0, 32);

    const { data: device, error } = await supabase
      .from('devices')
      .select(`
        *,
        locations (
          location_name,
          location_code
        )
      `)
      .eq('device_identifier', deviceId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !device) {
      throw new Error('Device not registered. Please register this device first.');
    }

    setDevice({
      id: device.id,
      device_name: device.device_name,
      device_code: device.device_code,
      location_id: device.location_id,
      location_name: device.locations.location_name
    });

    // Update device heartbeat
    try {
      await supabase
        .from('device_heartbeats')
        .insert({
          device_id: device.id,
          status: 'online',
          camera_status: 'working',
          network_status: 'connected'
        });
    } catch (heartbeatError) {
      console.warn('Failed to update device heartbeat:', heartbeatError);
    }
  };

  const sendHeartbeat = async () => {
    if (!device) return;
    
    try {
      await supabase
        .from('device_heartbeats')
        .insert({
          device_id: device.id,
          status: isOnline ? 'online' : 'offline',
          camera_status: cameraStream ? 'working' : 'error',
          network_status: isOnline ? 'connected' : 'disconnected'
        });
      
      setLastHeartbeat(new Date());
    } catch (error) {
      console.warn('Failed to send heartbeat:', error);
    }
  };

  const speakMessage = (message: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    
    try {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.volume = 0.8;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Text-to-speech failed:', error);
    }
  };

  const waitForVideoElement = (): Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
      const maxAttempts = 20; // Wait up to 2 seconds
      let attempts = 0;
      
      const checkElement = () => {
        attempts++;
        if (videoRef.current) {
          console.log('✅ Video element found after', attempts, 'attempts');
          resolve(videoRef.current);
        } else if (attempts >= maxAttempts) {
          reject(new Error('Video element not available after waiting'));
        } else {
          setTimeout(checkElement, 100);
        }
      };
      
      checkElement();
    });
  };

  const initializeCamera = async () => {
    try {
      console.log('🎥 Initializing camera...');
      
      // Wait for video element to be available
      const videoElement = await waitForVideoElement();
      console.log('📹 Video element ready, proceeding with camera setup');
      
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      // Get available devices first
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('📹 Available video devices:', videoDevices.length);
        
        if (videoDevices.length === 0) {
          throw new Error('No camera devices found');
        }
      } catch (devicesError) {
        console.warn('Could not enumerate devices:', devicesError);
      }

      // Try to get camera stream with progressive fallbacks
      let mediaStream: MediaStream | null = null;
      const constraints = [
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false
        },
        {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        },
        {
          video: true,
          audio: false
        }
      ];

      for (let i = 0; i < constraints.length; i++) {
        try {
          console.log(`🎥 Trying camera constraint ${i + 1}/${constraints.length}`);
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          console.log('✅ Camera stream obtained with constraint', i + 1);
          break;
        } catch (constraintError) {
          console.warn(`❌ Constraint ${i + 1} failed:`, constraintError);
          if (i === constraints.length - 1) {
            throw constraintError;
          }
        }
      }

      if (!mediaStream) {
        throw new Error('Unable to access camera with any configuration');
      }

      // Set up video stream
      videoElement.srcObject = mediaStream;
      setCameraStream(mediaStream);
      
      // Wait for video to be ready before starting face detection
      const startFaceDetection = () => {
        console.log('📹 Video ready, starting face detection');
        setFaceDetectionActive(true);
        startFaceRecognitionLoop();
      };

      videoElement.onloadedmetadata = startFaceDetection;
      
      // Fallback: Start face detection after a short delay
      setTimeout(() => {
        console.log('⏰ Fallback: Ensuring face detection is active');
        setFaceDetectionActive(true);
        startFaceRecognitionLoop();
      }, 2000);

    } catch (error: any) {
      console.error('Camera initialization error:', error);
      setFaceDetectionActive(false);
      
      // Provide more specific error messages
      let errorMessage = 'Camera access denied. Please allow camera access.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please click "Allow" when prompted and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please ensure a camera is connected.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application. Please close other apps and try again.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support the required resolution. Trying with basic settings...';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const startFaceRecognitionLoop = () => {
    let recognitionInterval: NodeJS.Timeout;

    const recognitionLoop = async () => {
      // Stop recognition loop if:
      // 1. Face detection is disabled
      // 2. No video element
      // 3. Currently processing an employee (prevents race conditions)
      // 4. Currently showing results or errors
      if (!faceDetectionActive || !videoRef.current || currentEmployee || isProcessing) {
        console.log('🛑 Skipping recognition loop:', {
          faceDetectionActive,
          hasVideo: !!videoRef.current,
          hasCurrentEmployee: !!currentEmployee,
          isProcessing
        });
        return;
      }

      try {
        setIsProcessing(true);
        
        // Try face recognition if service is available
        try {
          const detection = await faceRecognition.detectFace(videoRef.current);
          
          if (detection) {
            const quality = faceRecognition.assessFaceQuality(detection);
            
            if (quality.isGood) {
              console.log('✅ Good quality face detected, attempting recognition...');
              setCurrentEmployee({ recognizing: true });
              
              const recognition = await faceRecognition.recognizeEmployee(detection);
              
              if (recognition && recognition.confidence > 0.75) {
                console.log('🎯 Employee recognized successfully:', {
                  employee: recognition.employee.full_name,
                  confidence: recognition.confidence
                });
                
                // Stop the recognition loop by clearing the interval
                if (recognitionInterval) {
                  clearInterval(recognitionInterval);
                }
                
                await handleEmployeeRecognized(recognition.employee, recognition.confidence);
                return;
              } else {
                // Log recognition attempt for debugging
                console.log('⚠️ Face detected but not recognized:', {
                  hasRecognition: !!recognition,
                  confidence: recognition?.confidence || 0,
                  threshold: 0.75
                });
                setCurrentEmployee({ error: 'Face not recognized. Please try again or contact admin.' });
                
                // Stop recognition loop temporarily to show error
                if (recognitionInterval) {
                  clearInterval(recognitionInterval);
                }
                
                setTimeout(() => {
                  setCurrentEmployee(null);
                  setIsProcessing(false);
                  // Restart recognition loop after error clears
                  startFaceRecognitionLoop();
                }, 3000);
                return;
              }
            } else {
              console.log('📏 Face quality not good enough:', quality.message);
            }
          } else {
            console.log('👤 No face detected in frame');
          }
        } catch (faceError) {
          console.warn('Face recognition error, falling back to manual mode:', faceError);
        }
        
        // Reset processing state if no face detected or quality issues
        setIsProcessing(false);
      } catch (error) {
        console.error('Recognition loop error:', error);
        setCurrentEmployee({ error: 'Recognition error. Please try again.' });
        
        // Stop recognition loop temporarily
        if (recognitionInterval) {
          clearInterval(recognitionInterval);
        }
        
        setTimeout(() => {
          setCurrentEmployee(null);
          setIsProcessing(false);
          // Restart recognition loop after error clears
          startFaceRecognitionLoop();
        }, 3000);
      }
    };

    recognitionInterval = setInterval(recognitionLoop, 2000);
    
    return () => {
      if (recognitionInterval) {
        clearInterval(recognitionInterval);
      }
    };
  };

  // Get employee current status including breaks and temp exits
  const getEmployeeStatus = async (employeeId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_employee_current_status_with_breaks', {
        emp_id: employeeId
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting employee status:', error);
      return null;
    }
  };

  // Handle break return
  const handleBreakReturn = async (employee: any) => {
    try {
      const { data: result, error } = await supabase.rpc('end_break', {
        emp_id: employee.id,
        location_id: device?.location_id,
        device_id: device?.id
      });

      if (error) throw error;

      setCurrentEmployee(employee);
      setAttendanceAction({ result: { message: (result as any).message } });

      setTimeout(() => {
        setCurrentEmployee(null);
        setAttendanceAction(null);
        setIsProcessing(false);
        startFaceRecognitionLoop();
      }, 3000);

    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleEmployeeRecognized = async (employee: any, confidence: number) => {
    try {
      // Check employee status including breaks and temp exits
      const status = await getEmployeeStatus(employee.id);
      setEmployeeStatus(status);
      
      // Handle different employee statuses
      if (status) {
        const statusData = status as any;
        
        // If employee is on break, handle break return
        if (statusData.status === 'on_break') {
          await handleBreakReturn(employee);
          return;
        }
        
        // If employee is on temporary exit, handle return
        if (statusData.status === 'temporary_exit') {
          // Process return from temporary exit
          const { error: returnError } = await supabase.rpc('process_attendance_action', {
            emp_id: employee.id,
            location_id: device?.location_id,
            device_id: device?.id,
            action_type: 'temp_return',
            confidence_score: confidence,
            temp_exit_id: statusData.temp_exit_id
          });

          if (returnError) throw returnError;

          setCurrentEmployee(employee);
          setAttendanceAction({ 
            result: { message: `Welcome back from temporary exit! (${statusData.exit_reason})` }
          });

          speakMessage(`Welcome back from temporary exit!`);

          // Return to standby after 3 seconds
          setTimeout(() => {
            setCurrentEmployee(null);
            setAttendanceAction(null);
            setEmployeeStatus(null);
          }, 3000);
          return;
        }
      }

      // Handle normal attendance action
      const { data: actionResult, error: actionError } = await supabase.rpc('determine_attendance_action', {
        emp_id: employee.id,
        current_location_id: device?.location_id
      });

      if (actionError) throw actionError;

      const action = actionResult as any;
      setCurrentEmployee(employee);
      setAttendanceAction(action);

      // Show action options for checked-in employees at the same location
      if (action.action === 'clock_out' || (status && (status as any).status === 'checked_in')) {
        console.log('🔄 Employee already checked in, showing action options');
        speakMessage("Hello! What would you like to do today?");
        setKioskState('standby');
        return; // Don't auto-process, show options instead
      }

      // Speak the message
      speakMessage(action.message || "Attendance recorded successfully!");

      // Process the action
      const { error: processError } = await supabase.rpc('process_attendance_action', {
        emp_id: employee.id,
        location_id: device?.location_id,
        device_id: device?.id,
        action_type: action.action,
        confidence_score: confidence
      });

      if (processError) throw processError;
      
      setTimeout(() => {
        setCurrentEmployee(null);
        setAttendanceAction(null);
        setEmployeeStatus(null);
        setIsProcessing(false);
        // Restart recognition loop after processing complete
        startFaceRecognitionLoop();
      }, 3000);

    } catch (error: any) {
      setError(error.message);
      setCurrentEmployee(null);
      setIsProcessing(false);
      // Restart recognition loop after error
      setTimeout(() => {
        startFaceRecognitionLoop();
      }, 2000);
    }
  };

  // Temporary Exit Functions
  const handleTempExitRequest = async () => {
    if (!currentEmployee) return;
    setKioskState('temp_exit_reasons');
  };

  const selectTempExitReason = (reason: string) => {
    setSelectedTempExitReason(reason);
    setKioskState('temp_exit_duration');
  };

  const selectTempExitDuration = (duration: number) => {
    setSelectedDuration(duration);
    submitTempExitRequest();
  };

  const submitTempExitRequest = async () => {
    if (!currentEmployee || !selectedTempExitReason || !selectedDuration) return;

    try {
      setKioskState('processing');
      
      const { data: result, error } = await supabase.rpc('request_temporary_exit', {
        emp_id: currentEmployee.id,
        location_id: device?.location_id,
        device_id: device?.id,
        exit_reason: selectedTempExitReason,
        estimated_duration_hours: selectedDuration
      });

      if (error) throw error;

      setTempExitRequest(result);
      
      if ((result as any).status === 'approved') {
        setKioskState('temp_exit_approved');
        speakMessage('Exit approved. You may leave now.');
        
        // Process the exit
        await supabase.rpc('process_attendance_action', {
          emp_id: currentEmployee.id,
          location_id: device?.location_id,
          device_id: device?.id,
          action_type: 'temp_out',
          confidence_score: 0.95
        });
      } else {
        setKioskState('temp_exit_pending');
        speakMessage('Exit request submitted for approval.');
      }

      setTimeout(() => {
        setCurrentEmployee(null);
        setTempExitRequest(null);
        setSelectedTempExitReason(null);
        setSelectedDuration(null);
        setKioskState('standby');
      }, 5000);

    } catch (error: any) {
      setError(error.message);
      setKioskState('standby');
    }
  };

  // Break Management Functions
  const handleBreakRequest = async () => {
    if (!currentEmployee) return;
    setKioskState('break_types');
  };

  const selectBreakType = async (breakType: string) => {
    if (!currentEmployee) return;

    try {
      setKioskState('processing');
      setSelectedBreakType(breakType);

      const duration = breakType === 'Lunch Break' ? 60 : 
                     breakType === 'Coffee Break' ? 15 :
                     breakType === 'Rest Break' ? 10 :
                     breakType === 'Prayer Break' ? 15 : 15;

      const { data: result, error } = await supabase.rpc('start_break', {
        emp_id: currentEmployee.id,
        location_id: device?.location_id,
        device_id: device?.id,
        break_type: breakType.toLowerCase().replace(' ', '_'),
        planned_duration: duration
      });

      if (error) throw error;

      speakMessage(`${breakType} started. Enjoy your break!`);
      
      setAttendanceAction({ 
        result: { message: `${breakType} started successfully. Enjoy your break!` }
      });

      setTimeout(() => {
        setCurrentEmployee(null);
        setAttendanceAction(null);
        setSelectedBreakType(null);
        setKioskState('standby');
      }, 3000);

    } catch (error: any) {
      setError(error.message);
      setKioskState('standby');
    }
  };

  const resetKioskState = () => {
    setCurrentEmployee(null);
    setAttendanceAction(null);
    setTempExitRequest(null);
    setSelectedTempExitReason(null);
    setSelectedDuration(null);
    setSelectedBreakType(null);
    setEmployeeStatus(null);
    setKioskState('standby');
  };

  if (isLoading) {
    return <LoadingSkeleton type="kiosk" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>System Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button onClick={async () => {
              setError(null);
              setIsLoading(true);
              try {
                await initializeCamera();
                setIsLoading(false);
              } catch (error: any) {
                setError(error.message);
                setIsLoading(false);
              }
            }}>
              Retry Camera Access
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-2">
      {/* Status Bar */}
      <div className="flex items-center justify-between mb-4 px-4 py-2 bg-card/90 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <img src={jusTrackLogo} alt="JusTrack" className="h-8 w-auto" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{device?.location_name}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            {isOnline ? (
              <><Wifi className="h-4 w-4 text-success" /><span className="text-success">Online</span></>
            ) : (
              <><WifiOff className="h-4 w-4 text-destructive" /><span className="text-destructive">Offline</span></>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="p-2"
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="p-2"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <div className="text-lg font-mono">
            {currentTime.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Main Kiosk Interface */}
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <Card className="w-full max-w-2xl shadow-elegant backdrop-blur-sm bg-card/95 border-border/50">
          <CardContent className="p-12 text-center space-y-8">
            {/* Camera Feed */}
            <div className="relative mx-auto max-w-md">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video rounded-xl border-4 border-primary shadow-lg"
              />
              {!isOnline && (
                <div className="absolute inset-0 bg-black/80 rounded-xl flex items-center justify-center">
                  <div className="text-center text-white">
                    <WifiOff className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-lg font-semibold">Offline Mode</p>
                    <p className="text-sm">Limited functionality available</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Dynamic Status Display Based on Kiosk State */}
            {kioskState === 'processing' ? (
              <div className="space-y-6">
                <Loader2 className="h-20 w-20 animate-spin mx-auto text-primary" />
                <div>
                  <h2 className="text-4xl font-bold mb-2">Processing...</h2>
                  <p className="text-xl text-muted-foreground">Please wait a moment</p>
                </div>
              </div>
            ) : kioskState === 'temp_exit_reasons' ? (
              <div className="space-y-6">
                <LogOut className="h-20 w-20 mx-auto text-orange-500" />
                <div>
                  <h2 className="text-4xl font-bold mb-4">Temporary Exit Request</h2>
                  <p className="text-xl text-muted-foreground mb-6">Please select your reason:</p>
                  <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                    {[
                      'Urgent Work',
                      'Personal Emergency', 
                      'Meeting Outside',
                      'Client Visit',
                      'Lunch Break',
                      'Other'
                    ].map((reason) => (
                      <Button
                        key={reason}
                        variant="outline"
                        size="lg"
                        className="h-16 text-lg font-semibold"
                        onClick={() => selectTempExitReason(reason)}
                      >
                        {reason}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-6"
                    onClick={resetKioskState}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : kioskState === 'temp_exit_duration' ? (
              <div className="space-y-6">
                <Timer className="h-20 w-20 mx-auto text-orange-500" />
                <div>
                  <h2 className="text-4xl font-bold mb-4">Duration Estimate</h2>
                  <p className="text-xl text-muted-foreground mb-2">Reason: {selectedTempExitReason}</p>
                  <p className="text-lg text-muted-foreground mb-6">How long will you be away?</p>
                  <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                    {[
                      { label: '15 minutes', value: 0.25 },
                      { label: '30 minutes', value: 0.5 },
                      { label: '1 hour', value: 1 },
                      { label: '2 hours', value: 2 }
                    ].map(({ label, value }) => (
                      <Button
                        key={value}
                        variant="outline"
                        size="lg"
                        className="h-16 text-lg font-semibold"
                        onClick={() => selectTempExitDuration(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-6"
                    onClick={() => setKioskState('temp_exit_reasons')}
                  >
                    Back
                  </Button>
                </div>
              </div>
            ) : kioskState === 'temp_exit_pending' ? (
              <div className="space-y-6">
                <Clock className="h-20 w-20 mx-auto text-orange-500" />
                <div>
                  <h2 className="text-4xl font-bold mb-4">Request Submitted</h2>
                  <p className="text-xl text-muted-foreground">Waiting for admin approval...</p>
                  <div className="mt-4 p-4 bg-muted/20 rounded-lg">
                    <p><strong>Reason:</strong> {selectedTempExitReason}</p>
                    <p><strong>Duration:</strong> {selectedDuration} hours</p>
                  </div>
                </div>
              </div>
            ) : kioskState === 'temp_exit_approved' ? (
              <div className="space-y-6">
                <CheckCircle2 className="h-20 w-20 mx-auto text-success" />
                <div>
                  <h2 className="text-4xl font-bold text-success mb-4">Exit Approved!</h2>
                  <p className="text-xl text-muted-foreground">You may leave now</p>
                  <div className="mt-4 p-4 bg-muted/20 rounded-lg">
                    <p><strong>Reason:</strong> {selectedTempExitReason}</p>
                    <p><strong>Duration:</strong> {selectedDuration} hours</p>
                    <p><strong>Return by:</strong> {new Date(Date.now() + (selectedDuration || 0) * 60 * 60 * 1000).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            ) : kioskState === 'break_types' ? (
              <div className="space-y-6">
                <Coffee className="h-20 w-20 mx-auto text-blue-500" />
                <div>
                  <h2 className="text-4xl font-bold mb-4">Start Break</h2>
                  <p className="text-xl text-muted-foreground mb-6">Select break type:</p>
                  <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                    {[
                      { type: 'Lunch Break', duration: '30-60 min', icon: Utensils },
                      { type: 'Coffee Break', duration: '15 min', icon: Coffee },
                      { type: 'Rest Break', duration: '10 min', icon: Timer },
                      { type: 'Prayer Break', duration: '15 min', icon: Clock }
                    ].map(({ type, duration, icon: Icon }) => (
                      <Button
                        key={type}
                        variant="outline"
                        size="lg"
                        className="h-20 text-lg font-semibold flex flex-col gap-1"
                        onClick={() => selectBreakType(type)}
                      >
                        <Icon className="h-6 w-6" />
                        <span>{type}</span>
                        <span className="text-sm text-muted-foreground">({duration})</span>
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-6"
                    onClick={resetKioskState}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : currentEmployee?.recognizing ? (
              <div className="space-y-6">
                <Loader2 className="h-20 w-20 animate-spin mx-auto text-primary" />
                <div>
                  <h2 className="text-4xl font-bold mb-2">Recognizing Face</h2>
                  <p className="text-xl text-muted-foreground">Please hold still...</p>
                </div>
              </div>
            ) : currentEmployee?.error ? (
              <div className="space-y-6">
                <XCircle className="h-20 w-20 mx-auto text-destructive" />
                <div>
                  <h2 className="text-4xl font-bold text-destructive mb-2">Recognition Failed</h2>
                  <p className="text-xl text-muted-foreground">{currentEmployee.error}</p>
                </div>
              </div>
            ) : attendanceAction?.result && attendanceAction?.result.message ? (
              <div className="space-y-6">
                <CheckCircle2 className="h-20 w-20 mx-auto text-success" />
                <div>
                  <h2 className="text-4xl font-bold text-success mb-2">Success!</h2>
                  <p className="text-xl text-muted-foreground">
                    {attendanceAction.result.message}
                  </p>
                  {currentEmployee && (
                    <div className="mt-4 p-4 bg-muted/20 rounded-lg">
                      <p className="text-lg font-semibold">{currentEmployee.full_name}</p>
                      <p className="text-sm text-muted-foreground">{currentEmployee.employee_code}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : currentEmployee && attendanceAction && !attendanceAction?.result && !attendanceAction?.message ? (
              // Employee is checked in - show action options
              <div className="space-y-6">
                <User className="h-20 w-20 mx-auto text-primary" />
                <div>
                  <div className="mb-6 p-6 bg-muted/20 rounded-lg">
                    <h2 className="text-3xl font-bold mb-2">{currentEmployee.full_name}</h2>
                    <p className="text-lg text-muted-foreground mb-1">{currentEmployee.employee_code}</p>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      {employeeStatus?.status === 'checked_in' ? 'Checked In' : 
                       employeeStatus?.status === 'on_break' ? 'On Break' :
                       employeeStatus?.status === 'temporary_exit' ? 'Temporary Exit' : 'Available'}
                    </Badge>
                    {employeeStatus?.since && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Since: {new Date(employeeStatus.since).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                   
                   {attendanceAction?.action === 'clock_out' || employeeStatus?.status === 'checked_in' ? (
                     <div>
                       <h3 className="text-2xl font-semibold mb-2">You're already clocked in!</h3>
                       <p className="text-lg text-muted-foreground mb-6">What would you like to do?</p>
                      <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
                        <Button
                          size="lg"
                          className="h-16 text-lg font-semibold"
                          onClick={() => {
                            // Process clock out
                            supabase.rpc('process_attendance_action', {
                              emp_id: currentEmployee.id,
                              location_id: device?.location_id,
                              device_id: device?.id,
                              action_type: 'clock_out',
                              confidence_score: 0.95
                            }).then(() => {
                              setAttendanceAction({ result: { message: 'Successfully clocked out. See you tomorrow!' } });
                              speakMessage('Successfully clocked out. See you tomorrow!');
                              setTimeout(resetKioskState, 3000);
                            });
                          }}
                        >
                          <LogOut className="mr-2 h-5 w-5" />
                          Clock Out
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-16 text-lg font-semibold"
                          onClick={handleTempExitRequest}
                        >
                          <LogOut className="mr-2 h-5 w-5" />
                          Need to Step Out?
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-16 text-lg font-semibold"
                          onClick={handleBreakRequest}
                        >
                          <Coffee className="mr-2 h-5 w-5" />
                          Start Break
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xl text-muted-foreground mb-4">
                        {attendanceAction?.message || 'Ready for your next action'}
                      </p>
                      <Button
                        size="lg"
                        className="h-16 text-lg font-semibold px-8"
                        onClick={() => {
                          // Process the recommended action
                          supabase.rpc('process_attendance_action', {
                            emp_id: currentEmployee.id,
                            location_id: device?.location_id,
                            device_id: device?.id,
                            action_type: attendanceAction.action,
                            confidence_score: 0.95
                          }).then(() => {
                            setAttendanceAction({ result: { message: attendanceAction.message } });
                            speakMessage(attendanceAction.message);
                            setTimeout(resetKioskState, 3000);
                          });
                        }}
                      >
                        {attendanceAction?.action === 'clock_in' && 'Clock In'}
                        {attendanceAction?.action === 'location_transfer' && 'Transfer Here'}
                        {attendanceAction?.action === 'clock_out' && 'Clock Out'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <Camera className="h-20 w-20 mx-auto text-primary animate-pulse" />
                <div>
                  <h2 className="text-4xl font-bold mb-2">Show Your Face</h2>
                  <p className="text-xl text-muted-foreground">
                    Look at the camera to record attendance
                  </p>
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p>Position your face in the camera frame</p>
                    <p>Ensure good lighting for best results</p>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Access - Only show when in standby */}
            {!currentEmployee && !isProcessing && kioskState === 'standby' && (
              <div className="flex justify-center gap-4 pt-8">
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-6 text-lg"
                  onClick={() => navigate('/admin/login')}
                >
                  <Settings className="mr-2 h-5 w-5" />
                  Admin Access
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KioskInterface;