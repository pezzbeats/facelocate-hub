-- Add missing columns to locations table
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS working_hours_start TIME DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS working_hours_end TIME DEFAULT '18:00';

-- Add comments for documentation
COMMENT ON COLUMN public.locations.radius_meters IS 'Attendance radius in meters for location-based check-in/out';
COMMENT ON COLUMN public.locations.working_hours_start IS 'Working hours start time for this location';
COMMENT ON COLUMN public.locations.working_hours_end IS 'Working hours end time for this location';