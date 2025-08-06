import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { faceRecognitionService } from "@/services/FaceRecognitionService";
import { Camera, CheckCircle2, XCircle, RotateCcw, Save } from "lucide-react";

interface FaceRegistrationProps {
  employee: {
    id: string;
    employee_code: string;
    full_name: string;
    face_registered: boolean;
  };
  onComplete: () => void;
  onCancel: () => void;
}

const FaceRegistration = ({ employee, onComplete, onCancel }: FaceRegistrationProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [registrationStep, setRegistrationStep] = useState<'setup' | 'capturing' | 'processing' | 'complete'>('setup');
  const [capturedFaces, setCapturedFaces] = useState<Float32Array[]>([]);
  const [currentCapture, setCurrentCapture] = useState(0);
  const [faceQuality, setFaceQuality] = useState<{ score: number; message: string; isGood: boolean } | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { toast } = useToast();

  const totalCaptures = 3; // Front, slight left, slight right
  const captureInstructions = [
    "Look straight at the camera",
    "Turn your head slightly to the left",
    "Turn your head slightly to the right"
  ];

  useEffect(() => {
    initializeCamera();
    loadFaceModels();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const loadFaceModels = async () => {
    try {
      await faceRecognitionService.loadModels();
    } catch (error) {
      toast({
        title: "Model Loading Failed",
        description: "Face recognition models could not be loaded.",
        variant: "destructive"
      });
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
        // Automatically start capturing mode when camera is ready
        setRegistrationStep('capturing');
        startFaceDetection();
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraStatus('error');
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to register your face.",
        variant: "destructive"
      });
    }
  };

  const startFaceDetection = () => {
    const detectFaces = async () => {
      if (videoRef.current && registrationStep === 'capturing') {
        try {
          // Ensure video is playing and has loaded
          if (videoRef.current.readyState < 2) {
            console.log('Video not ready yet, waiting...');
            setFaceQuality({ score: 0, message: 'Camera loading...', isGood: false });
            return;
          }

          console.log('Attempting face detection...');
          const detection = await faceRecognitionService.detectFace(videoRef.current);
          
          if (detection) {
            console.log('Face detected, assessing quality...');
            const quality = faceRecognitionService.assessFaceQuality(detection);
            console.log('Face quality:', quality);
            setFaceQuality(quality);
          } else {
            console.log('No face detected');
            setFaceQuality({ score: 0, message: 'No face detected', isGood: false });
          }
        } catch (error) {
          console.error('Face detection error:', error);
          setFaceQuality({ score: 0, message: 'Face detection failed', isGood: false });
        }
      }
    };

    // Wait for video to be ready, then start detection
    const startDetection = () => {
      if (videoRef.current) {
        const video = videoRef.current;
        if (video.readyState >= 2) {
          console.log('Video ready, starting face detection');
          detectFaces();
          const interval = setInterval(detectFaces, 500);
          return () => clearInterval(interval);
        } else {
          console.log('Video not ready, waiting for loadeddata event');
          video.addEventListener('loadeddata', () => {
            console.log('Video loaded, starting face detection');
            detectFaces();
            const interval = setInterval(detectFaces, 500);
            return () => clearInterval(interval);
          }, { once: true });
        }
      }
    };

    return startDetection();
  };

  const captureFace = async () => {
    if (!videoRef.current) return;

    try {
      const faceDescriptor = await faceRecognitionService.captureAndEncodeFace(videoRef.current);
      
      if (faceDescriptor) {
        setCapturedFaces(prev => [...prev, faceDescriptor]);
        
        if (currentCapture < totalCaptures - 1) {
          setCurrentCapture(prev => prev + 1);
          toast({
            title: "Face Captured",
            description: `Capture ${currentCapture + 1} of ${totalCaptures} completed.`,
          });
        } else {
          // All captures complete
          setRegistrationStep('processing');
          await saveFaceData([...capturedFaces, faceDescriptor]);
        }
      }
    } catch (error: any) {
      toast({
        title: "Capture Failed",
        description: error.message || "Failed to capture face. Please try again.",
        variant: "destructive"
      });
    }
  };

  const saveFaceData = async (faceDescriptors: Float32Array[]) => {
    try {
      // Convert Float32Array to regular arrays for JSON storage
      const encodings = faceDescriptors.map(desc => Array.from(desc));

      const { error } = await supabase
        .from('employees')
        .update({
          face_encodings: encodings,
          face_registered: true,
          face_registration_date: new Date().toISOString()
        })
        .eq('id', employee.id);

      if (error) throw error;

      // Log the registration attempt
      await supabase
        .from('face_registration_logs')
        .insert({
          employee_id: employee.id,
          attempt_number: 1,
          success: true,
          quality_score: faceQuality?.score || 0
        });

      setRegistrationStep('complete');
      toast({
        title: "Face Registration Complete",
        description: `${employee.full_name}'s face has been registered successfully.`,
      });

      setTimeout(() => {
        onComplete();
      }, 2000);

    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to save face data.",
        variant: "destructive"
      });
      setRegistrationStep('capturing');
    }
  };

  const resetCapture = () => {
    setCapturedFaces([]);
    setCurrentCapture(0);
    setRegistrationStep('capturing');
  };

  if (cameraStatus === 'error') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <CardTitle>Camera Access Required</CardTitle>
          <CardDescription>
            Please allow camera access to register face recognition
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={initializeCamera} className="mr-2">
            <Camera className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Face Registration</CardTitle>
        <CardDescription>
          Register face recognition for {employee.full_name} ({employee.employee_code})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Registration Progress</span>
            <span>{currentCapture + 1} of {totalCaptures}</span>
          </div>
          <Progress value={(currentCapture / totalCaptures) * 100} />
        </div>

        {/* Camera Feed */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-96 object-cover"
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />
          
          {/* Face Detection Overlay */}
          {registrationStep === 'capturing' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-white rounded-lg w-64 h-64 flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="text-lg font-medium mb-2">
                    {captureInstructions[currentCapture]}
                  </div>
                  {faceQuality && (
                    <Badge variant={faceQuality.isGood ? "default" : "secondary"}>
                      {faceQuality.message}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Face Quality Indicator */}
        {faceQuality && registrationStep === 'capturing' && (
          <div className="text-center">
            <Badge variant={faceQuality.isGood ? "default" : "secondary"} className="text-sm">
              {faceQuality.message}
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          {registrationStep === 'setup' && (
            <Button onClick={() => setRegistrationStep('capturing')} size="lg">
              <Camera className="mr-2 h-4 w-4" />
              Start Registration
            </Button>
          )}

          {registrationStep === 'capturing' && (
            <>
              <Button 
                onClick={captureFace} 
                disabled={!faceQuality?.isGood}
                size="lg"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture Face
              </Button>
              <Button variant="outline" onClick={resetCapture}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </>
          )}

          {registrationStep === 'processing' && (
            <Button disabled size="lg">
              <Save className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </Button>
          )}

          {registrationStep === 'complete' && (
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
              <p className="text-lg font-medium">Registration Complete!</p>
            </div>
          )}
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={onCancel}>
            Cancel Registration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FaceRegistration;