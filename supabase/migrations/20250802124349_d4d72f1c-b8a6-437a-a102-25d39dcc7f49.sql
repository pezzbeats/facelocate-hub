-- JusTrack Simplified Database Schema
-- Complete foundation for location-based face recognition attendance system

-- 1. Authentication & Admin Management
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text CHECK (role IN ('super_admin', 'admin', 'hr')) DEFAULT 'admin',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_users
CREATE POLICY "Admin users can view all admin users" 
ON public.admin_users FOR SELECT 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE is_active = true));

CREATE POLICY "Super admins can manage all admin users" 
ON public.admin_users FOR ALL 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE role = 'super_admin' AND is_active = true));

-- System configuration
CREATE TABLE public.system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for system_config
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy for system_config
CREATE POLICY "Authenticated users can view system config" 
ON public.system_config FOR SELECT 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE is_active = true));

CREATE POLICY "Admins can manage system config" 
ON public.system_config FOR ALL 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE role IN ('super_admin', 'admin') AND is_active = true));

-- Insert initial system config
INSERT INTO public.system_config (config_key, config_value, description) VALUES
('company_name', 'Your Company Name', 'Company name for branding'),
('face_confidence_threshold', '0.85', 'Minimum confidence score for face recognition'),
('temp_exit_auto_approve_hours', '1', 'Auto-approve temporary exits under this duration'),
('offline_mode_enabled', 'true', 'Enable offline mode for devices'),
('max_daily_clock_events', '10', 'Maximum clock in/out events per employee per day');

-- 2. Location & Device Management
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name text NOT NULL,
  location_code text UNIQUE NOT NULL,
  address text,
  description text,
  latitude decimal(10,8),
  longitude decimal(11,8),
  timezone text DEFAULT 'Asia/Kolkata',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for locations
CREATE POLICY "All authenticated users can view active locations" 
ON public.locations FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage locations" 
ON public.locations FOR ALL 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE role IN ('super_admin', 'admin') AND is_active = true));

-- Kiosk devices registered to locations
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL,
  device_code text UNIQUE NOT NULL,
  device_identifier text UNIQUE NOT NULL,
  location_id uuid REFERENCES public.locations(id) NOT NULL,
  is_active boolean DEFAULT true,
  is_online boolean DEFAULT false,
  last_heartbeat timestamp with time zone,
  registration_date timestamp with time zone DEFAULT now(),
  device_settings jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for devices
CREATE POLICY "All users can view active devices" 
ON public.devices FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage devices" 
ON public.devices FOR ALL 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE role IN ('super_admin', 'admin') AND is_active = true));

-- Device heartbeat logs for monitoring
CREATE TABLE public.device_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.devices(id) NOT NULL,
  status text CHECK (status IN ('online', 'offline', 'error')) DEFAULT 'online',
  cpu_usage decimal(5,2),
  memory_usage decimal(5,2),
  camera_status text CHECK (camera_status IN ('working', 'error', 'permission_denied')),
  network_status text CHECK (network_status IN ('connected', 'disconnected', 'slow')),
  error_message text,
  timestamp timestamp with time zone DEFAULT now()
);

-- Enable RLS for device_heartbeats
ALTER TABLE public.device_heartbeats ENABLE ROW LEVEL SECURITY;

-- RLS Policy for device_heartbeats
CREATE POLICY "Admins can view device heartbeats" 
ON public.device_heartbeats FOR SELECT 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE is_active = true));

-- 3. Employee Management
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE,
  phone text,
  department text NOT NULL,
  designation text,
  hire_date date,
  face_encodings jsonb,
  face_image_url text,
  default_location_id uuid REFERENCES public.locations(id),
  is_active boolean DEFAULT true,
  face_registered boolean DEFAULT false,
  face_registration_date timestamp with time zone,
  created_by uuid REFERENCES public.admin_users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "All users can view active employees" 
ON public.employees FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage employees" 
ON public.employees FOR ALL 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE is_active = true));

-- Face registration attempts log
CREATE TABLE public.face_registration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) NOT NULL,
  attempt_number integer NOT NULL,
  success boolean DEFAULT false,
  quality_score decimal(3,2),
  error_message text,
  registered_by uuid REFERENCES public.admin_users(id),
  timestamp timestamp with time zone DEFAULT now()
);

-- Enable RLS for face_registration_logs
ALTER TABLE public.face_registration_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for face_registration_logs
CREATE POLICY "Admins can view face registration logs" 
ON public.face_registration_logs FOR SELECT 
USING (auth.uid() IN (SELECT id FROM public.admin_users WHERE is_active = true));

-- 4. Attendance Tracking
CREATE TABLE public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) NOT NULL,
  location_id uuid REFERENCES public.locations(id) NOT NULL,
  device_id uuid REFERENCES public.devices(id) NOT NULL,
  event_type text CHECK (event_type IN ('clock_in', 'clock_out', 'temp_out', 'temp_in', 'transfer_out', 'transfer_in')) NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  confidence_score decimal(3,2),
  notes text,
  approved_by uuid REFERENCES public.admin_users(id),
  is_manual boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for attendance_events
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy for attendance_events
CREATE POLICY "All users can view attendance events" 
ON public.attendance_events FOR SELECT 
USING (true);

CREATE POLICY "System can insert attendance events" 
ON public.attendance_events FOR INSERT 
WITH CHECK (true);

-- Temporary exit requests and tracking
CREATE TABLE public.temporary_exits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) NOT NULL,
  location_id uuid REFERENCES public.locations(id) NOT NULL,
  reason text NOT NULL,
  estimated_duration_hours decimal(3,1),
  requested_at timestamp with time zone DEFAULT now(),
  status text CHECK (status IN ('pending', 'approved', 'denied', 'completed')) DEFAULT 'pending',
  approved_by uuid REFERENCES public.admin_users(id),
  approval_time timestamp with time zone,
  denial_reason text,
  exit_event_id uuid REFERENCES public.attendance_events(id),
  return_event_id uuid REFERENCES public.attendance_events(id),
  actual_duration_hours decimal(3,1),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for temporary_exits
ALTER TABLE public.temporary_exits ENABLE ROW LEVEL SECURITY;

-- RLS Policy for temporary_exits
CREATE POLICY "All users can view temporary exits" 
ON public.temporary_exits FOR SELECT 
USING (true);

CREATE POLICY "System can manage temporary exits" 
ON public.temporary_exits FOR ALL 
WITH CHECK (true);

-- Insert default locations
INSERT INTO public.locations (location_name, location_code, address, description) VALUES
('Main Entrance', 'ME01', 'Building Main Entrance', 'Primary entry point for all employees'),
('Reception Area', 'RC01', 'Ground Floor Reception', 'Reception and visitor management area'),
('Warehouse Gate', 'WG01', 'Warehouse Entrance', 'Warehouse and storage area entrance');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at
    BEFORE UPDATE ON public.system_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();