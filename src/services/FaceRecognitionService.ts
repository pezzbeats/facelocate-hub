import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';

export class FaceRecognitionService {
  private modelsLoaded = false;
  private employeeDescriptors: Map<string, { descriptors: Float32Array[], employee: any }> = new Map();

  async loadModels(): Promise<void> {
    if (this.modelsLoaded) return;

    try {
      console.log('Starting to load face recognition models...');
      
      // Load models sequentially to avoid race conditions
      console.log('Loading tiny face detector...');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      
      console.log('Loading face landmark model...');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      
      console.log('Loading face recognition model...');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      
      // Optional: face expression model
      try {
        console.log('Loading face expression model...');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
      } catch (expError) {
        console.warn('Face expression model failed to load (optional):', expError);
      }

      this.modelsLoaded = true;
      console.log('✅ All face recognition models loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load face recognition models:', error);
      
      // Try alternative loading method for debugging
      try {
        console.log('Attempting alternative model loading...');
        const modelPath = window.location.origin + '/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
        
        this.modelsLoaded = true;
        console.log('✅ Models loaded with alternative method');
      } catch (altError) {
        console.error('❌ Alternative loading also failed:', altError);
        throw new Error(`Face recognition models failed to load. Original error: ${error.message}`);
      }
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
      // Mobile-optimized detection options
      const detection = await faceapi
        .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320, // Smaller input size for mobile performance
          scoreThreshold: 0.3 // Lower threshold for mobile cameras
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        console.log('Face detected successfully:', {
          score: detection.detection.score,
          box: detection.detection.box
        });
      }

      return detection;
    } catch (error) {
      console.error('Face detection error:', error);
      return null;
    }
  }

  assessFaceQuality(detection: any): { score: number; message: string; isGood: boolean } {
    const landmarks = detection.landmarks;
    const box = detection.detection.box;
    
    // Check face size (should be reasonable portion of frame) - more lenient for mobile
    const faceArea = box.width * box.height;
    const frameArea = 1280 * 720; // Assuming 720p
    const faceRatio = faceArea / frameArea;
    
    if (faceRatio < 0.02) { // More lenient minimum size
      return { score: 0.3, message: 'Please move closer to the camera', isGood: false };
    }
    if (faceRatio > 0.6) { // More lenient maximum size
      return { score: 0.3, message: 'Please move back from the camera', isGood: false };
    }
    
    // Check face angle using landmarks - more lenient
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    const eyeDistance = Math.abs(leftEye[0].x - rightEye[0].x);
    const faceWidth = box.width;
    const symmetryRatio = eyeDistance / faceWidth;
    
    if (symmetryRatio < 0.15) { // More lenient angle tolerance
      return { score: 0.4, message: 'Please face the camera directly', isGood: false };
    }
    
    // Check detection confidence - more lenient for mobile
    const detectionScore = detection.detection.score;
    if (detectionScore < 0.4) { // Lower threshold for mobile
      return { score: 0.5, message: 'Please ensure good lighting', isGood: false };
    }
    
    return { score: 0.9, message: 'Face detected - ready to capture!', isGood: true };
  }

  async recognizeEmployee(detection: any): Promise<{ employee: any; confidence: number } | null> {
    if (!detection || this.employeeDescriptors.size === 0) {
      console.log('🔍 Recognition failed: no detection or no employee descriptors', {
        hasDetection: !!detection,
        employeeCount: this.employeeDescriptors.size
      });
      return null;
    }

    let bestMatch: { employee: any; confidence: number } | null = null;
    let highestConfidence = 0;
    const allMatches: Array<{ employee: string; confidence: number }> = [];

    console.log('🔍 Starting face recognition with', this.employeeDescriptors.size, 'employees');

    for (const [employeeId, { descriptors, employee }] of this.employeeDescriptors) {
      for (const storedDescriptor of descriptors) {
        const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor);
        const confidence = Math.max(0, 1 - distance);
        
        allMatches.push({ employee: employee.full_name, confidence });
        
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          if (confidence > 0.75) { // Lowered threshold from 0.85 to 0.75
            bestMatch = { employee, confidence };
          }
        }
      }
    }

    console.log('🎯 Recognition results:', {
      highestConfidence,
      bestMatch: bestMatch ? bestMatch.employee.full_name : 'none',
      allMatches: allMatches.sort((a, b) => b.confidence - a.confidence)
    });

    return bestMatch;
  }

  async captureAndEncodeFace(videoElement: HTMLVideoElement): Promise<Float32Array | null> {
    const detection = await this.detectFace(videoElement);
    if (!detection) {
      throw new Error('No face detected. Please ensure your face is clearly visible in the camera.');
    }

    const quality = this.assessFaceQuality(detection);
    if (!quality.isGood) {
      throw new Error(quality.message);
    }

    console.log('Face captured successfully with quality score:', quality.score);
    return detection.descriptor;
  }
}

export const faceRecognitionService = new FaceRecognitionService();