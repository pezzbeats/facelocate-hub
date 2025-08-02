import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { 
  Camera, 
  MapPin, 
  Clock, 
  User, 
  Settings,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle2,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jusTrackLogo from "@/assets/justrack-logo.png";

// Face recognition service types
interface FaceRecognitionResult {
  success: boolean;
  employee?: any;
  confidence?: number;
  message?: string;
}

interface AttendanceAction {
  action: string;
  message: string;
  location_change?: boolean;
  previous_location?: string;
  hours_worked?: number;
  temp_exit_id?: string;
}

interface KioskState {
  status: 'standby' | 'detecting' | 'recognizing' | 'confirming' | 'processing' | 'success' | 'error';
  currentEmployee: any | null;
  attendanceAction: AttendanceAction | null;
  errorMessage: string | null;
  lastEvents: any[];
  countdown: number;
}

// Camera hook
const useKioskCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setCameraStatus('ready');
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraStatus('error');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return { videoRef, cameraStatus, startCamera, stopCamera };
};

// Device management
const useDeviceInfo = () => {
  const [deviceInfo, setDeviceInfo] = useState({
    deviceId: '',
    name: '',
    location: '',
    locationId: '',
    isOnline: true
  });

  useEffect(() => {
    const loadDeviceInfo = () => {
      const savedDeviceId = localStorage.getItem('justrack_device_id');
      const savedName = localStorage.getItem('justrack_device_name');
      const savedLocation = localStorage.getItem('justrack_device_location');
      const savedLocationId = localStorage.getItem('justrack_device_location_id');
      
      setDeviceInfo({
        deviceId: savedDeviceId || '',
        name: savedName || 'Kiosk Device',
        location: savedLocation || 'Unknown Location',
        locationId: savedLocationId || '',
        isOnline: true
      });
    };

    loadDeviceInfo();
  }, []);

  return deviceInfo;
};

// Simulated face recognition (will be replaced with actual face-api.js)
const useFaceRecognition = () => {
  const recognizeFace = async (videoElement: HTMLVideoElement): Promise<FaceRecognitionResult> => {
    // Simulate face recognition delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo: simulate finding an employee 50% of the time
    if (Math.random() > 0.5) {
      return {
        success: true,
        employee: {
          id: 'demo-employee-1',
          employee_code: 'EMP001',
          full_name: 'John Demo',
          department: 'Engineering'
        },
        confidence: 0.95,
        message: 'Face recognized successfully'
      };
    }
    
    return {
      success: false,
      message: 'Face not recognized. Please try again.'
    };
  };

  return { recognizeFace };
};

// Attendance service
const useAttendanceService = () => {
  const determineAction = async (employeeId: string, locationId: string): Promise<any> => {
    try {
      const { data, error } = await supabase.rpc('determine_attendance_action', {
        emp_id: employeeId,
        current_location_id: locationId
      });

      if (error) throw error;
      return data as unknown as AttendanceAction;
    } catch (error) {
      console.error('Error determining attendance action:', error);
      return {
        action: 'clock_in',
        message: 'Welcome! Please clock in to start your day.'
      };
    }
  };

  const processAction = async (
    employeeId: string,
    locationId: string,
    deviceId: string,
    actionType: string,
    confidenceScore: number = 0.95,
    notes?: string
  ) => {
    try {
      const { data, error } = await supabase.rpc('process_attendance_action', {
        emp_id: employeeId,
        location_id: locationId,
        device_id: deviceId,
        action_type: actionType,
        confidence_score: confidenceScore,
        notes
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error processing attendance action:', error);
      throw error;
    }
  };

  return { determineAction, processAction };
};

// Main kiosk state management
const useKioskState = (deviceInfo: any) => {
  const [state, setState] = useState<KioskState>({
    status: 'standby',
    currentEmployee: null,
    attendanceAction: null,
    errorMessage: null,
    lastEvents: [],
    countdown: 0
  });
  
  const { toast } = useToast();
  const attendanceService = useAttendanceService();

  const handleFaceDetected = async (employee: any) => {
    setState(prev => ({ 
      ...prev, 
      status: 'recognizing', 
      currentEmployee: employee 
    }));

    try {
      const action = await attendanceService.determineAction(
        employee.id, 
        deviceInfo.locationId
      );
      
      setState(prev => ({ 
        ...prev, 
        attendanceAction: action as AttendanceAction,
        status: 'confirming',
        countdown: 5
      }));
      
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error',
        errorMessage: 'Failed to determine action. Please try again.'
      }));
    }
  };

  const confirmAction = async () => {
    if (!state.currentEmployee || !state.attendanceAction) return;

    setState(prev => ({ ...prev, status: 'processing' }));

    try {
      const result = await attendanceService.processAction(
        state.currentEmployee.id,
        deviceInfo.locationId,
        deviceInfo.deviceId,
        state.attendanceAction.action,
        0.95
      );

      setState(prev => ({ 
        ...prev, 
        status: 'success'
      }));

      toast({
        title: "Success!",
        description: "Attendance recorded successfully",
        duration: 3000,
      });

      // Return to standby after 3 seconds
      setTimeout(() => {
        setState({
          status: 'standby',
          currentEmployee: null,
          attendanceAction: null,
          errorMessage: null,
          lastEvents: [],
          countdown: 0
        });
      }, 3000);

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error',
        errorMessage: 'Failed to process attendance. Please try again.'
      }));
      
      toast({
        title: "Error",
        description: "Failed to process attendance. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetToStandby = () => {
    setState({
      status: 'standby',
      currentEmployee: null,
      attendanceAction: null,
      errorMessage: null,
      lastEvents: [],
      countdown: 0
    });
  };

  return { state, handleFaceDetected, confirmAction, resetToStandby };
};

// Kiosk Header Component
const KioskHeader: React.FC<{ deviceInfo: any; onSettings: () => void }> = ({ 
  deviceInfo, 
  onSettings 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-elegant">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={jusTrackLogo} alt="JusTrack" className="h-10 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">JusTrack Kiosk</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{deviceInfo.location}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-lg font-semibold text-foreground">
                {currentTime.toLocaleTimeString()}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentTime.toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {deviceInfo.isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-success" />
                  <span className="text-success font-medium">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-destructive" />
                  <span className="text-destructive font-medium">Offline</span>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onSettings}
              className="shrink-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Standby Screen Component
const StandbyScreen: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraStatus: string;
  onFaceDetected: (employee: any) => void;
}> = ({ videoRef, cameraStatus, onFaceDetected }) => {
  const faceRecognition = useFaceRecognition();
  const [isScanning, setIsScanning] = useState(false);

  // Simulate face scanning every 2 seconds when camera is ready
  useEffect(() => {
    if (cameraStatus !== 'ready' || isScanning) return;

    const scanInterval = setInterval(async () => {
      if (videoRef.current && !isScanning) {
        setIsScanning(true);
        const result = await faceRecognition.recognizeFace(videoRef.current);
        if (result.success && result.employee) {
          onFaceDetected(result.employee);
        }
        setIsScanning(false);
      }
    }, 2000);

    return () => clearInterval(scanInterval);
  }, [cameraStatus, isScanning, onFaceDetected]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
      {/* Camera Section */}
      <div className="relative">
        <Card className="w-[600px] h-[400px] overflow-hidden border-2 border-primary/20 shadow-kiosk">
          <CardContent className="p-0 h-full relative">
            {cameraStatus === 'ready' ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Face detection overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <div className="w-48 h-48 border-4 border-primary/60 rounded-lg animate-pulse">
                      <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-primary"></div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-primary"></div>
                      <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-primary"></div>
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-primary"></div>
                    </div>
                    {isScanning && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-48 bg-primary/60 animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Status indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-card/90 px-3 py-2 rounded-lg">
                  <div className="h-3 w-3 bg-success rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">
                    {isScanning ? 'Scanning...' : 'Ready'}
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <div className="text-center">
                  {cameraStatus === 'loading' ? (
                    <>
                      <Camera className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
                      <p className="text-lg font-medium">Initializing camera...</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                      <p className="text-lg font-medium text-destructive">Camera not available</p>
                      <p className="text-sm text-muted-foreground mt-2">Please check camera permissions</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <div className="text-center space-y-4">
        <h2 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Face Recognition Attendance
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Position your face within the guide box and look directly at the camera for recognition
        </p>
        <div className="flex items-center justify-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">System Ready</span>
        </div>
      </div>

      {/* Quick Instructions */}
      <Card className="max-w-md bg-muted/30 border-muted">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3 text-center">For Best Results:</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Stand directly in front of the camera</p>
            <p>• Remove glasses or hats if possible</p>
            <p>• Ensure good lighting on your face</p>
            <p>• Wait for the green confirmation</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Recognition Screen Component
const RecognitionScreen: React.FC<{ employee: any }> = ({ employee }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-md w-full text-center shadow-kiosk">
        <CardContent className="pt-8 pb-6">
          <div className="space-y-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-primary rounded-full mx-auto flex items-center justify-center">
                <User className="h-12 w-12 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-success rounded-full p-2">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {employee.full_name}
              </h3>
              <p className="text-muted-foreground">{employee.employee_code}</p>
              <p className="text-sm text-muted-foreground">{employee.department}</p>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Face Recognized Successfully</span>
            </div>
            
            <div className="space-y-2">
              <div className="animate-pulse">
                <div className="h-2 bg-primary/20 rounded-full">
                  <div className="h-2 bg-primary rounded-full animate-[loading_2s_ease-in-out_infinite]"></div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Determining attendance action...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Confirmation Screen Component
const ConfirmationScreen: React.FC<{
  employee: any;
  action: AttendanceAction;
  countdown: number;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ employee, action, countdown, onConfirm, onCancel }) => {
  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'clock_in': return 'success';
      case 'clock_out': return 'primary';
      case 'location_transfer': return 'warning';
      case 'temp_return': return 'success';
      default: return 'primary';
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'clock_in': return CheckCircle2;
      case 'clock_out': return Clock;
      case 'location_transfer': return ArrowLeft;
      case 'temp_return': return CheckCircle2;
      default: return Clock;
    }
  };

  const ActionIcon = getActionIcon(action.action);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-lg w-full shadow-kiosk">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto flex items-center justify-center mb-4">
            <ActionIcon className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{employee.full_name}</CardTitle>
          <CardDescription className="text-base">{employee.employee_code} • {employee.department}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className={`text-${getActionColor(action.action)} border-${getActionColor(action.action)}`}>
              {action.action.replace('_', ' ').toUpperCase()}
            </Badge>
            <p className="text-lg font-medium">{action.message}</p>
            {action.location_change && (
              <p className="text-sm text-muted-foreground">
                Previous location: {action.previous_location}
              </p>
            )}
            {action.hours_worked && (
              <p className="text-sm text-muted-foreground">
                Hours worked: {action.hours_worked.toFixed(1)}
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button 
              variant="admin" 
              className="flex-1" 
              onClick={onConfirm}
            >
              Confirm {action.action === 'location_transfer' ? 'Transfer' : action.action.replace('_', ' ')}
              {countdown > 0 && ` (${countdown})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Processing Screen Component
const ProcessingScreen: React.FC = () => {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-md w-full text-center shadow-kiosk">
        <CardContent className="pt-8 pb-6">
          <div className="space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto flex items-center justify-center">
              <Clock className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Processing...</h3>
              <p className="text-muted-foreground">Recording your attendance</p>
            </div>
            <div className="space-y-2">
              <div className="animate-pulse">
                <div className="h-2 bg-primary/20 rounded-full">
                  <div className="h-2 bg-primary rounded-full animate-[loading_1s_ease-in-out_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Success Screen Component  
const SuccessScreen: React.FC<{ employee: any; action: AttendanceAction }> = ({ employee, action }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-md w-full text-center shadow-kiosk bg-gradient-to-br from-success/5 to-success/10 border-success/20">
        <CardContent className="pt-8 pb-6">
          <div className="space-y-6">
            <div className="w-20 h-20 bg-gradient-success rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-success mb-2">Success!</h3>
              <p className="text-lg font-medium">{employee.full_name}</p>
              <p className="text-muted-foreground">{action.message}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Time: {new Date().toLocaleTimeString()}</p>
              <p>Returning to main screen...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Error Screen Component
const ErrorScreen: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-md w-full text-center shadow-kiosk bg-destructive/5 border-destructive/20">
        <CardContent className="pt-8 pb-6">
          <div className="space-y-6">
            <div className="w-16 h-16 bg-destructive/10 rounded-full mx-auto flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-destructive mb-2">Error</h3>
              <p className="text-muted-foreground">{message}</p>
            </div>
            <Button onClick={onRetry} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Kiosk Component
const KioskInterface: React.FC = () => {
  const navigate = useNavigate();
  const deviceInfo = useDeviceInfo();
  const { videoRef, cameraStatus, startCamera } = useKioskCamera();
  const { state, handleFaceDetected, confirmAction, resetToStandby } = useKioskState(deviceInfo);

  // Check device registration
  useEffect(() => {
    if (!deviceInfo.deviceId || !deviceInfo.locationId) {
      navigate('/kiosk/register');
      return;
    }
    
    startCamera();
  }, [deviceInfo.deviceId, deviceInfo.locationId, navigate]);

  // Auto-confirm countdown
  useEffect(() => {
    if (state.status === 'confirming' && state.countdown > 0) {
      const timer = setTimeout(() => {
        if (state.countdown === 1 && state.attendanceAction?.action !== 'location_transfer') {
          confirmAction();
        } else {
          // Update countdown (would need state management for this)
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.status, state.countdown, state.attendanceAction?.action]);

  if (!deviceInfo.deviceId) {
    return (
      <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking device registration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-kiosk flex flex-col">
      <KioskHeader 
        deviceInfo={deviceInfo} 
        onSettings={() => navigate('/kiosk/register')} 
      />
      
      <main className="flex-1 flex flex-col">
        {state.status === 'standby' && (
          <StandbyScreen 
            videoRef={videoRef}
            cameraStatus={cameraStatus}
            onFaceDetected={handleFaceDetected}
          />
        )}
        
        {state.status === 'recognizing' && (
          <RecognitionScreen employee={state.currentEmployee} />
        )}
        
        {state.status === 'confirming' && state.currentEmployee && state.attendanceAction && (
          <ConfirmationScreen 
            employee={state.currentEmployee}
            action={state.attendanceAction}
            countdown={state.countdown}
            onConfirm={confirmAction}
            onCancel={resetToStandby}
          />
        )}
        
        {state.status === 'processing' && (
          <ProcessingScreen />
        )}
        
        {state.status === 'success' && state.currentEmployee && state.attendanceAction && (
          <SuccessScreen 
            employee={state.currentEmployee}
            action={state.attendanceAction}
          />
        )}
        
        {state.status === 'error' && (
          <ErrorScreen 
            message={state.errorMessage || 'An error occurred'}
            onRetry={resetToStandby}
          />
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-card/95 backdrop-blur-sm border-t border-border py-4">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>Powered by Shatak Infotech • JusTrack Simplified v1.0</p>
        </div>
      </footer>
    </div>
  );
};

export default KioskInterface;