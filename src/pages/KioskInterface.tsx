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
  LogOut,
  Coffee,
  Utensils,
  Timer,
  AlertTriangle
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
    countdown: 0,
    employeeStatus: null,
    pendingRequest: null
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
            location_id: deviceInfo?.location_id,
            device_id: deviceInfo?.id,
            action_type: 'temp_return',
            confidence_score: confidence,
            temp_exit_id: statusData.temp_exit_id
          });

          if (returnError) throw returnError;

          setKioskState(prev => ({
            ...prev,
            status: 'success',
            currentEmployee: employee,
            attendanceAction: { 
              result: { message: `Welcome back from temporary exit! (${statusData.exit_reason})` }
            }
          }));

          // Return to standby after 3 seconds
          setTimeout(() => {
            setKioskState({
              status: 'standby',
              currentEmployee: null,
              attendanceAction: null,
              errorMessage: null,
              countdown: 0,
              employeeStatus: null,
              pendingRequest: null
            });
          }, 3000);
          return;
        }
      }

      // Determine regular attendance action
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
        employeeStatus: status,
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
          countdown: 0,
          employeeStatus: null,
          pendingRequest: null
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
      countdown: 0,
      employeeStatus: null,
      pendingRequest: null
    });
  };

  // Manual employee selection for fallback
  const handleManualMode = () => {
    window.location.href = '/kiosk/manual';
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

  // Handle temporary exit request
  const handleTempExitRequest = async (employee: any) => {
    try {
      const status = await getEmployeeStatus(employee.id);
      
      if ((status as any)?.status !== 'checked_in') {
        setKioskState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: 'You must be checked in to request a temporary exit.'
        }));
        return;
      }

      setKioskState(prev => ({
        ...prev,
        status: 'temp_exit_request',
        currentEmployee: employee,
        employeeStatus: status
      }));
    } catch (error: any) {
      setKioskState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message
      }));
    }
  };

  // Submit temporary exit request
  const submitTempExitRequest = async (reason: string, estimatedHours: number) => {
    try {
      setKioskState(prev => ({ ...prev, status: 'processing' }));

      const { data: result, error } = await supabase.rpc('request_temporary_exit', {
        emp_id: kioskState.currentEmployee?.id,
        location_id: deviceInfo?.location_id,
        device_id: deviceInfo?.id,
        exit_reason: reason,
        estimated_duration_hours: estimatedHours
      });

      if (error) throw error;

      setKioskState(prev => ({
        ...prev,
        status: 'temp_exit_status',
        pendingRequest: result
      }));

      if ((result as any).status === 'approved') {
        // Process the exit immediately
        const { error: exitError } = await supabase.rpc('process_attendance_action', {
          emp_id: kioskState.currentEmployee?.id,
          location_id: deviceInfo?.location_id,
          device_id: deviceInfo?.id,
          action_type: 'temp_out',
          confidence_score: 1.0,
          notes: `Temporary exit: ${reason}`
        });

        if (exitError) throw exitError;
      }

      // Return to standby after showing status
      setTimeout(() => {
        setKioskState({
          status: 'standby',
          currentEmployee: null,
          attendanceAction: null,
          errorMessage: null,
          countdown: 0,
          employeeStatus: null,
          pendingRequest: null
        });
      }, 5000);

    } catch (error: any) {
      setKioskState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message
      }));
    }
  };

  // Handle break request
  const handleBreakRequest = async (employee: any) => {
    try {
      const status = await getEmployeeStatus(employee.id);
      
      if ((status as any)?.status !== 'checked_in') {
        setKioskState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: 'You must be checked in to start a break.'
        }));
        return;
      }

      setKioskState(prev => ({
        ...prev,
        status: 'break_request',
        currentEmployee: employee,
        employeeStatus: status
      }));
    } catch (error: any) {
      setKioskState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message
      }));
    }
  };

  // Submit break request
  const submitBreakRequest = async (breakType: string, plannedDuration: number) => {
    try {
      setKioskState(prev => ({ ...prev, status: 'processing' }));

      const { data: result, error } = await supabase.rpc('start_break', {
        emp_id: kioskState.currentEmployee?.id,
        location_id: deviceInfo?.location_id,
        device_id: deviceInfo?.id,
        break_type: breakType,
        planned_duration: plannedDuration
      });

      if (error) throw error;

      setKioskState(prev => ({
        ...prev,
        status: 'success',
        attendanceAction: { result, message: (result as any).message }
      }));

      // Return to standby after 3 seconds
      setTimeout(() => {
        setKioskState({
          status: 'standby',
          currentEmployee: null,
          attendanceAction: null,
          errorMessage: null,
          countdown: 0,
          employeeStatus: null,
          pendingRequest: null
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

  // Handle break return
  const handleBreakReturn = async (employee: any) => {
    try {
      setKioskState(prev => ({ ...prev, status: 'processing' }));

      const { data: result, error } = await supabase.rpc('end_break', {
        emp_id: employee.id,
        location_id: deviceInfo?.location_id,
        device_id: deviceInfo?.id
      });

      if (error) throw error;

      setKioskState(prev => ({
        ...prev,
        status: 'break_return',
        currentEmployee: employee,
        attendanceAction: { result, message: (result as any).message }
      }));

      // Return to standby after 3 seconds
      setTimeout(() => {
        setKioskState({
          status: 'standby',
          currentEmployee: null,
          attendanceAction: null,
          errorMessage: null,
          countdown: 0,
          employeeStatus: null,
          pendingRequest: null
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
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Auto-confirming in {kioskState.countdown} seconds...
                    </p>
                    <Button onClick={confirmAction} className="w-full">
                      Confirm Now
                    </Button>
                    
                    {/* Show additional options for checked-in employees */}
                    {(kioskState.employeeStatus as any)?.status === 'checked_in' && (kioskState.attendanceAction as any)?.action === 'clock_out' && (
                      <div className="border-t pt-3 space-y-2">
                        <p className="text-xs text-muted-foreground">Or choose another option:</p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTempExitRequest(kioskState.currentEmployee)}
                            className="flex-1"
                          >
                            <LogOut className="mr-1 h-3 w-3" />
                            Step Out
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleBreakRequest(kioskState.currentEmployee)}
                            className="flex-1"
                          >
                            <Coffee className="mr-1 h-3 w-3" />
                            Break
                          </Button>
                        </div>
                      </div>
                    )}
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

      case 'temp_exit_request':
        return (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-4">
              <LogOut className="h-16 w-16 text-primary" />
              <div className="text-left">
                <h2 className="text-2xl font-bold">{kioskState.currentEmployee?.full_name}</h2>
                <p className="text-muted-foreground">Request Temporary Exit</p>
              </div>
            </div>
            
            <Card className="max-w-lg mx-auto">
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-medium mb-4">Select exit reason and duration:</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => submitTempExitRequest('Urgent Work', 2)}
                    className="h-20 flex flex-col gap-2"
                  >
                    <AlertTriangle className="h-6 w-6" />
                    <span className="text-sm">Urgent Work</span>
                    <span className="text-xs text-muted-foreground">Auto-approved (2h)</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => submitTempExitRequest('Personal Emergency', 1)}
                    className="h-20 flex flex-col gap-2"
                  >
                    <XCircle className="h-6 w-6" />
                    <span className="text-sm">Emergency</span>
                    <span className="text-xs text-muted-foreground">Auto-approved (1h)</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => submitTempExitRequest('Meeting Outside', 2)}
                    className="h-20 flex flex-col gap-2"
                  >
                    <User className="h-6 w-6" />
                    <span className="text-sm">Meeting</span>
                    <span className="text-xs text-muted-foreground">Needs approval</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => submitTempExitRequest('Client Visit', 3)}
                    className="h-20 flex flex-col gap-2"
                  >
                    <MapPin className="h-6 w-6" />
                    <span className="text-sm">Client Visit</span>
                    <span className="text-xs text-muted-foreground">Needs approval</span>
                  </Button>
                </div>

                <Button variant="outline" onClick={cancelAction} className="w-full">
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'break_request':
        return (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-4">
              <Coffee className="h-16 w-16 text-primary" />
              <div className="text-left">
                <h2 className="text-2xl font-bold">{kioskState.currentEmployee?.full_name}</h2>
                <p className="text-muted-foreground">Start Break</p>
              </div>
            </div>
            
            <Card className="max-w-lg mx-auto">
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-medium mb-4">Select break type:</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => submitBreakRequest('lunch', 60)}
                    className="h-20 flex flex-col gap-2"
                  >
                    <Utensils className="h-6 w-6" />
                    <span className="text-sm">Lunch Break</span>
                    <span className="text-xs text-muted-foreground">60 minutes</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => submitBreakRequest('coffee', 15)}
                    className="h-20 flex flex-col gap-2"
                  >
                    <Coffee className="h-6 w-6" />
                    <span className="text-sm">Coffee Break</span>
                    <span className="text-xs text-muted-foreground">15 minutes</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => submitBreakRequest('rest', 30)}
                    className="h-20 flex flex-col gap-2"
                  >
                    <Timer className="h-6 w-6" />
                    <span className="text-sm">Rest Break</span>
                    <span className="text-xs text-muted-foreground">30 minutes</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => submitBreakRequest('regular', 15)}
                    className="h-20 flex flex-col gap-2"
                  >
                    <Clock className="h-6 w-6" />
                    <span className="text-sm">Regular Break</span>
                    <span className="text-xs text-muted-foreground">15 minutes</span>
                  </Button>
                </div>

                <Button variant="outline" onClick={cancelAction} className="w-full">
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'temp_exit_status':
        return (
          <div className="text-center space-y-6">
            {(kioskState.pendingRequest as any)?.status === 'approved' ? (
              <>
                <CheckCircle2 className="h-20 w-20 text-success mx-auto" />
                <div>
                  <h2 className="text-2xl font-bold text-success mb-2">Exit Approved!</h2>
                  <p className="text-lg">{(kioskState.pendingRequest as any)?.message}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    You may leave now. Safe travels!
                  </p>
                </div>
              </>
            ) : (
              <>
                <Clock className="h-20 w-20 text-warning mx-auto" />
                <div>
                  <h2 className="text-2xl font-bold text-warning mb-2">Pending Approval</h2>
                  <p className="text-lg">{(kioskState.pendingRequest as any)?.message}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Please wait for admin approval before leaving.
                  </p>
                </div>
              </>
            )}
          </div>
        );

      case 'break_return':
        return (
          <div className="text-center space-y-6">
            <CheckCircle2 className="h-20 w-20 text-success mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-success mb-2">Welcome Back!</h2>
              <p className="text-lg">{kioskState.attendanceAction?.message}</p>
              <div className="text-sm text-muted-foreground mt-2">
                <p>Break duration: {Math.round((kioskState.attendanceAction?.result as any)?.duration_minutes || 0)} minutes</p>
                {(kioskState.attendanceAction?.result as any)?.exceeded && (
                  <p className="text-warning">Break time exceeded planned duration</p>
                )}
              </div>
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