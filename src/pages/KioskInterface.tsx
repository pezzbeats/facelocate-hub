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
  status: 'loading' | 'standby' | 'detecting' | 'recognizing' | 'confirming' | 'processing' | 'success' | 'error' | 'temp_exit_request' | 'break_request' | 'temp_exit_status' | 'break_return';
  currentEmployee: any | null;
  attendanceAction: any | null;
  errorMessage: string | null;
  countdown: number;
  employeeStatus: any | null;
  pendingRequest: any | null;
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

  const initializeCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setCameraStream(mediaStream);
        setFaceDetectionActive(true);
        startFaceRecognitionLoop();
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setFaceDetectionActive(false);
      throw new Error('Camera access denied. Please allow camera access.');
    }
  };

  const startFaceRecognitionLoop = () => {
    let recognitionInterval: NodeJS.Timeout;

    const recognitionLoop = async () => {
      if (!faceDetectionActive || !videoRef.current) return;

      try {
        setIsProcessing(true);
        
        // Try face recognition if service is available
        try {
          const detection = await faceRecognition.detectFace(videoRef.current);
          
          if (detection) {
            const quality = faceRecognition.assessFaceQuality(detection);
            
            if (quality.isGood) {
              setCurrentEmployee({ recognizing: true });
              
              const recognition = await faceRecognition.recognizeEmployee(detection);
              
              if (recognition && recognition.confidence > 0.85) {
                await handleEmployeeRecognized(recognition.employee, recognition.confidence);
                return;
              } else {
                setCurrentEmployee({ error: 'Face not recognized. Please try again or contact admin.' });
                setTimeout(() => {
                  setCurrentEmployee(null);
                }, 3000);
                return;
              }
            }
          }
        } catch (faceError) {
          console.warn('Face recognition error, falling back to manual mode:', faceError);
        }
        
        // Reset to standby if no face detected
        setIsProcessing(false);
      } catch (error) {
        console.error('Recognition loop error:', error);
        setCurrentEmployee({ error: 'Recognition error. Please try again.' });
        setTimeout(() => {
          setCurrentEmployee(null);
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
      }, 3000);

    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleEmployeeRecognized = async (employee: any, confidence: number) => {
    try {
      // Check employee status including breaks and temp exits
      const status = await getEmployeeStatus(employee.id);
      
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

          // Return to standby after 3 seconds
          setTimeout(() => {
            setCurrentEmployee(null);
            setAttendanceAction(null);
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
      }, 3000);

    } catch (error: any) {
      setError(error.message);
    }
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
            <Button onClick={() => window.location.reload()}>
              Retry
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
            
            {/* Status Display */}
            {currentEmployee?.recognizing ? (
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
            ) : attendanceAction?.result || attendanceAction?.message ? (
              <div className="space-y-6">
                <CheckCircle2 className="h-20 w-20 mx-auto text-success" />
                <div>
                  <h2 className="text-4xl font-bold text-success mb-2">Success!</h2>
                  <p className="text-xl text-muted-foreground">
                    {attendanceAction?.result?.message || attendanceAction?.message}
                  </p>
                  {currentEmployee && (
                    <div className="mt-4 p-4 bg-muted/20 rounded-lg">
                      <p className="text-lg font-semibold">{currentEmployee.full_name}</p>
                      <p className="text-sm text-muted-foreground">{currentEmployee.employee_code}</p>
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

            {/* Emergency Actions */}
            {!currentEmployee && !isProcessing && (
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