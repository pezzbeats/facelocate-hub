import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { faceRecognitionService } from "@/services/FaceRecognitionService";
import { 
  Camera, 
  MapPin, 
  Clock, 
  User, 
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut
} from "lucide-react";
import jusTrackLogo from "@/assets/justrack-logo.png";

interface KioskState {
  status: 'loading' | 'standby' | 'detecting' | 'recognizing' | 'confirming' | 'processing' | 'success' | 'error';
  currentEmployee: any | null;
  attendanceAction: any | null;
  errorMessage: string | null;
  countdown: number;
}

interface DeviceInfo {
  id: string;
  device_name: string;
  device_code: string;
  location_id: string;
  location_name: string;
}

const KioskInterface = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();

  const [kioskState, setKioskState] = useState<KioskState>({
    status: 'loading',
    currentEmployee: null,
    attendanceAction: null,
    errorMessage: null,
    countdown: 0
  });

  useEffect(() => {
    initializeKiosk();
    
    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timeInterval);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initializeKiosk = async () => {
    try {
      // Check device registration
      await checkDeviceRegistration();
      
      // Load face recognition models
      try {
        await faceRecognitionService.loadModels();
        await faceRecognitionService.loadEmployeeDescriptors();
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
      
      setKioskState(prev => ({ ...prev, status: 'standby' }));
    } catch (error: any) {
      setKioskState(prev => ({ 
        ...prev, 
        status: 'error', 
        errorMessage: error.message 
      }));
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

    setDeviceInfo({
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
        setStream(mediaStream);
        setCameraStatus('ready');
        startFaceRecognitionLoop();
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraStatus('error');
      throw new Error('Camera access denied. Please allow camera access.');
    }
  };

  const startFaceRecognitionLoop = () => {
    let recognitionInterval: NodeJS.Timeout;

    const recognitionLoop = async () => {
      if (kioskState.status !== 'standby' || !videoRef.current) return;

      try {
        setKioskState(prev => ({ ...prev, status: 'detecting' }));
        
        // Try face recognition if service is available
        try {
          const detection = await faceRecognitionService.detectFace(videoRef.current);
          
          if (detection) {
            const quality = faceRecognitionService.assessFaceQuality(detection);
            
            if (quality.isGood) {
              setKioskState(prev => ({ ...prev, status: 'recognizing' }));
              
              const recognition = await faceRecognitionService.recognizeEmployee(detection);
              
              if (recognition && recognition.confidence > 0.85) {
                await handleEmployeeRecognized(recognition.employee, recognition.confidence);
                return;
              } else {
                setKioskState(prev => ({ 
                  ...prev, 
                  status: 'error',
                  errorMessage: 'Face not recognized. Please try again or contact admin.'
                }));
                setTimeout(() => {
                  setKioskState(prev => ({ ...prev, status: 'standby', errorMessage: null }));
                }, 3000);
                return;
              }
            }
          }
        } catch (faceError) {
          console.warn('Face recognition error, falling back to manual mode:', faceError);
        }
        
        // Reset to standby if no face detected
        setKioskState(prev => {
          if (prev.status === 'detecting') {
            return { ...prev, status: 'standby' };
          }
          return prev;
        });
      } catch (error) {
        console.error('Recognition loop error:', error);
        setKioskState(prev => ({ 
          ...prev, 
          status: 'error',
          errorMessage: 'Recognition error. Please try again.'
        }));
        setTimeout(() => {
          setKioskState(prev => ({ ...prev, status: 'standby', errorMessage: null }));
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

  const handleEmployeeRecognized = async (employee: any, confidence: number) => {
    try {
      // Determine attendance action
      const { data: actionData, error: actionError } = await supabase.rpc('determine_attendance_action', {
        emp_id: employee.id,
        current_location_id: deviceInfo?.location_id
      });

      if (actionError) throw actionError;

      setKioskState(prev => ({
        ...prev,
        status: 'confirming',
        currentEmployee: employee,
        attendanceAction: actionData,
        countdown: 5
      }));

      // Auto-confirm after countdown or wait for user action
      const countdownInterval = setInterval(() => {
        setKioskState(prev => {
          if (prev.countdown <= 1) {
            clearInterval(countdownInterval);
            if ((actionData as any)?.action !== 'location_transfer') {
              processAttendanceAction(employee, actionData, confidence);
            }
            return { ...prev, countdown: 0 };
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);

    } catch (error: any) {
      setKioskState(prev => ({ 
        ...prev, 
        status: 'error',
        errorMessage: error.message
      }));
    }
  };

  const processAttendanceAction = async (employee: any, action: any, confidence: number) => {
    try {
      setKioskState(prev => ({ ...prev, status: 'processing' }));

      const { data: result, error } = await supabase.rpc('process_attendance_action', {
        emp_id: employee.id,
        location_id: deviceInfo?.location_id,
        device_id: deviceInfo?.id,
        action_type: action.action,
        confidence_score: confidence,
        notes: action.notes || null
      });

      if (error) throw error;

      setKioskState(prev => ({
        ...prev,
        status: 'success',
        attendanceAction: { ...action, result }
      }));

      // Return to standby after 3 seconds
      setTimeout(() => {
        setKioskState({
          status: 'standby',
          currentEmployee: null,
          attendanceAction: null,
          errorMessage: null,
          countdown: 0
        });
      }, 3000);

    } catch (error: any) {
      setKioskState(prev => ({ 
        ...prev, 
        status: 'error',
        errorMessage: error.message
      }));
    }
  };

  const confirmAction = () => {
    if (kioskState.currentEmployee && kioskState.attendanceAction) {
      processAttendanceAction(
        kioskState.currentEmployee, 
        kioskState.attendanceAction, 
        0.95
      );
    }
  };

  const cancelAction = () => {
    setKioskState({
      status: 'standby',
      currentEmployee: null,
      attendanceAction: null,
      errorMessage: null,
      countdown: 0
    });
  };

  // Manual employee selection for fallback
  const handleManualMode = () => {
    window.location.href = '/kiosk/manual';
  };

  // Render different states
  const renderContent = () => {
    switch (kioskState.status) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Initializing System</h2>
            <p className="text-muted-foreground">Loading face recognition models...</p>
          </div>
        );

      case 'standby':
      case 'detecting':
        return (
          <div className="text-center">
            <div className="relative mb-6">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full max-w-md mx-auto rounded-lg border-4 border-primary"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-white rounded-lg w-48 h-48 flex items-center justify-center">
                  <div className="text-white text-center">
                    <Camera className="h-8 w-8 mx-auto mb-2" />
                    <p>Position your face here</p>
                  </div>
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-2">Show Your Face</h2>
            <p className="text-xl text-muted-foreground mb-6">
              {kioskState.status === 'detecting' ? 'Detecting face...' : 'Look at the camera to clock in/out'}
            </p>
            <Button 
              variant="outline" 
              onClick={handleManualMode}
              className="mt-4"
            >
              Use Manual Mode
            </Button>
          </div>
        );

      case 'recognizing':
        return (
          <div className="text-center">
            <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Recognizing Face</h2>
            <p className="text-muted-foreground">Please wait...</p>
          </div>
        );

      case 'confirming':
        return (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-4">
              <User className="h-16 w-16 text-primary" />
              <div className="text-left">
                <h2 className="text-2xl font-bold">{kioskState.currentEmployee?.full_name}</h2>
                <p className="text-muted-foreground">{kioskState.currentEmployee?.employee_code}</p>
              </div>
            </div>
            
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-2">{kioskState.attendanceAction?.message}</h3>
                {kioskState.attendanceAction?.action === 'location_transfer' ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Transfer from {kioskState.attendanceAction.previous_location} to {deviceInfo?.location_name}?
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={confirmAction} className="flex-1">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirm Transfer
                      </Button>
                      <Button variant="outline" onClick={cancelAction} className="flex-1">
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Auto-confirming in {kioskState.countdown} seconds...
                    </p>
                    <Button onClick={confirmAction} className="w-full">
                      Confirm Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center">
            <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Processing</h2>
            <p className="text-muted-foreground">Recording attendance...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6">
            <CheckCircle2 className="h-20 w-20 text-success mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-success mb-2">Success!</h2>
              <p className="text-lg">{kioskState.attendanceAction?.result?.message}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {currentTime.toLocaleTimeString()}
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-6">
            <XCircle className="h-20 w-20 text-destructive mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-destructive mb-2">Error</h2>
              <p className="text-lg">{kioskState.errorMessage}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setKioskState(prev => ({ ...prev, status: 'standby', errorMessage: null }))}>
                Try Again
              </Button>
              <Button variant="outline" onClick={handleManualMode}>
                Manual Mode
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (cameraStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Camera Access Required</CardTitle>
            <CardDescription>
              Please allow camera access for face recognition
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button onClick={initializeCamera} className="mr-2">
              <Camera className="mr-2 h-4 w-4" />
              Enable Camera
            </Button>
            <Button variant="outline" onClick={handleManualMode}>
              Use Manual Mode
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-kiosk flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-elegant p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={jusTrackLogo} alt="JusTrack" className="h-10 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">JusTrack Kiosk</h1>
              <p className="text-sm text-muted-foreground">
                {deviceInfo?.location_name} • {deviceInfo?.device_name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{currentTime.toLocaleTimeString()}</p>
            <p className="text-sm text-muted-foreground">{currentTime.toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {renderContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Powered by Shatak Infotech • JusTrack Simplified v1.0
        </p>
      </footer>
    </div>
  );
};

export default KioskInterface;