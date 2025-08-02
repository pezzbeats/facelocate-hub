-- Add missing database tables

-- Add missing columns to locations table if they don't exist
DO $$
BEGIN
    -- Add radius_meters column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'radius_meters') THEN
        ALTER TABLE public.locations ADD COLUMN radius_meters integer DEFAULT 50;
    END IF;
    
    -- Add working_hours_start column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'working_hours_start') THEN
        ALTER TABLE public.locations ADD COLUMN working_hours_start time;
    END IF;
    
    -- Add working_hours_end column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'working_hours_end') THEN
        ALTER TABLE public.locations ADD COLUMN working_hours_end time;
    END IF;
END $$;

-- Create face_registration_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.face_registration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  success boolean NOT NULL DEFAULT false,
  quality_score numeric(3,2),
  error_message text,
  registered_by uuid REFERENCES public.admin_users(id),
  timestamp timestamp with time zone DEFAULT now()
);

-- Create device_heartbeats table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.device_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  status text CHECK (status IN ('online', 'offline', 'error')) NOT NULL DEFAULT 'online',
  camera_status text CHECK (camera_status IN ('working', 'error', 'unavailable')) NOT NULL DEFAULT 'working',
  network_status text CHECK (network_status IN ('connected', 'disconnected', 'poor')) NOT NULL DEFAULT 'connected',
  cpu_usage numeric(5,2),
  memory_usage numeric(5,2),
  error_message text,
  timestamp timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_face_registration_logs_employee_id ON public.face_registration_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_face_registration_logs_timestamp ON public.face_registration_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_id ON public.device_heartbeats(device_id);
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_timestamp ON public.device_heartbeats(timestamp DESC);

-- Enable RLS
ALTER TABLE public.face_registration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_heartbeats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for face_registration_logs
CREATE POLICY "Admins can view face registration logs" ON public.face_registration_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.admin_users WHERE is_active = true
    )
  );

CREATE POLICY "System can insert face registration logs" ON public.face_registration_logs
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for device_heartbeats  
CREATE POLICY "Admins can view device heartbeats" ON public.device_heartbeats
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.admin_users WHERE is_active = true
    )
  );

CREATE POLICY "System can insert device heartbeats" ON public.device_heartbeats
  FOR INSERT WITH CHECK (true);

-- Create employee current status view for real-time dashboard
CREATE OR REPLACE VIEW public.employee_current_status AS
SELECT 
  e.id as employee_id,
  e.employee_code,
  e.full_name,
  e.department,
  e.face_image_url,
  CASE 
    WHEN latest.event_type IN ('clock_in', 'temp_in', 'transfer_in') THEN 'present'
    WHEN latest.event_type IN ('clock_out', 'transfer_out') THEN 'absent'
    WHEN latest.event_type = 'temp_out' THEN 'temp_exit'
    ELSE 'absent'
  END as current_status,
  latest.event_type as last_event_type,
  latest.timestamp as last_activity,
  latest.location_id as current_location_id,
  l.location_name as current_location_name
FROM public.employees e
LEFT JOIN LATERAL (
  SELECT ae.event_type, ae.timestamp, ae.location_id
  FROM public.attendance_events ae
  WHERE ae.employee_id = e.id
  AND DATE(ae.timestamp) = CURRENT_DATE
  ORDER BY ae.timestamp DESC
  LIMIT 1
) latest ON true
LEFT JOIN public.locations l ON latest.location_id = l.id
WHERE e.is_active = true;