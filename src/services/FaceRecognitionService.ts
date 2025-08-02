import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';

export class FaceRecognitionService {
  private modelsLoaded = false;
  private employeeDescriptors: Map<string, { descriptors: Float32Array[], employee: any }> = new Map();

  async loadModels(): Promise<void> {
    if (this.modelsLoaded) return;

    try {
      // Load face-api.js models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/models')
      ]);

      this.modelsLoaded = true;
      console.log('Face recognition models loaded successfully');
    } catch (error) {
      console.error('Failed to load face recognition models:', error);
      throw new Error('Face recognition models failed to load. Please check model files.');
    }
  }

  async loadEmployeeDescriptors(): Promise<void> {
    try {
      const { data: employees, error } = await supabase
        .from('employees')
        .select('id, employee_code, full_name, face_encodings, face_image_url')
        .eq('is_active', true)
        .eq('face_registered', true);

      if (error) throw error;

      this.employeeDescriptors.clear();
      
      employees?.forEach(employee => {
        if (employee.face_encodings && Array.isArray(employee.face_encodings)) {
          const descriptors = employee.face_encodings.map((encoding: number[]) => 
            new Float32Array(encoding)
          );
          this.employeeDescriptors.set(employee.id, {
            descriptors,
            employee
          });
        }
      });
      
      console.log(`Loaded face descriptors for ${this.employeeDescriptors.size} employees`);
    } catch (error) {
      console.error('Failed to load employee descriptors:', error);
      throw error;
    }
  }

  async detectFace(videoElement: HTMLVideoElement): Promise<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection; }, faceapi.FaceLandmarks68> & { descriptor: Float32Array; } | null> {
    if (!this.modelsLoaded) {
      throw new Error('Face recognition models not loaded');
    }

    try {
      const detection = await faceapi
        .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.5
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      return detection;
    } catch (error) {
      console.error('Face detection error:', error);
      return null;
    }
  }

  assessFaceQuality(detection: any): { score: number; message: string; isGood: boolean } {
    const landmarks = detection.landmarks;
    const box = detection.detection.box;
    
    // Check face size (should be reasonable portion of frame)
    const faceArea = box.width * box.height;
    const frameArea = 1280 * 720; // Assuming 720p
    const faceRatio = faceArea / frameArea;
    
    if (faceRatio < 0.05) {
      return { score: 0.3, message: 'Please move closer to the camera', isGood: false };
    }
    if (faceRatio > 0.4) {
      return { score: 0.3, message: 'Please move back from the camera', isGood: false };
    }
    
    // Check face angle using landmarks
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    const eyeDistance = Math.abs(leftEye[0].x - rightEye[0].x);
    const faceWidth = box.width;
    const symmetryRatio = eyeDistance / faceWidth;
    
    if (symmetryRatio < 0.25) {
      return { score: 0.4, message: 'Please face the camera directly', isGood: false };
    }
    
    // Check detection confidence
    const detectionScore = detection.detection.score;
    if (detectionScore < 0.8) {
      return { score: 0.5, message: 'Please ensure good lighting', isGood: false };
    }
    
    return { score: 0.9, message: 'Face quality is excellent', isGood: true };
  }

  async recognizeEmployee(detection: any): Promise<{ employee: any; confidence: number } | null> {
    if (!detection || this.employeeDescriptors.size === 0) {
      return null;
    }

    let bestMatch: { employee: any; confidence: number } | null = null;
    let highestConfidence = 0;

    for (const [employeeId, { descriptors, employee }] of this.employeeDescriptors) {
      for (const storedDescriptor of descriptors) {
        const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor);
        const confidence = Math.max(0, 1 - distance);
        
        if (confidence > highestConfidence && confidence > 0.85) {
          highestConfidence = confidence;
          bestMatch = { employee, confidence };
        }
      }
    }

    return bestMatch;
  }

  async captureAndEncodeFace(videoElement: HTMLVideoElement): Promise<Float32Array | null> {
    const detection = await this.detectFace(videoElement);
    if (!detection) return null;

    const quality = this.assessFaceQuality(detection);
    if (!quality.isGood) {
      throw new Error(quality.message);
    }

    return detection.descriptor;
  }
}

export const faceRecognitionService = new FaceRecognitionService();