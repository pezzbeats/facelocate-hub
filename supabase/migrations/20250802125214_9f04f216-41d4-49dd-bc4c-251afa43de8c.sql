-- Fix function search path security issue
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Add core business logic functions with proper security
CREATE OR REPLACE FUNCTION public.determine_attendance_action(
    emp_id uuid,
    current_location_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    last_event record;
    temp_exit record;
    result jsonb;
BEGIN
    -- Get employee's last attendance event today
    SELECT ae.*, l.location_name 
    INTO last_event
    FROM public.attendance_events ae
    JOIN public.locations l ON ae.location_id = l.id
    WHERE ae.employee_id = emp_id
    AND DATE(ae.timestamp) = CURRENT_DATE
    ORDER BY ae.timestamp DESC
    LIMIT 1;
    
    -- Check for active temporary exit
    SELECT * INTO temp_exit
    FROM public.temporary_exits
    WHERE employee_id = emp_id
    AND status = 'approved'
    AND exit_event_id IS NOT NULL
    AND return_event_id IS NULL
    ORDER BY requested_at DESC
    LIMIT 1;
    
    -- If employee is on temporary exit
    IF temp_exit IS NOT NULL THEN
        RETURN jsonb_build_object(
            'action', 'temp_return',
            'message', 'Welcome back! Returning from temporary exit.',
            'temp_exit_id', temp_exit.id,
            'exit_duration', EXTRACT(EPOCH FROM (now() - (SELECT timestamp FROM public.attendance_events WHERE id = temp_exit.exit_event_id)))/3600
        );
    END IF;
    
    -- If no previous events today, this is first clock-in
    IF last_event IS NULL THEN
        RETURN jsonb_build_object(
            'action', 'clock_in',
            'message', 'Good morning! This will be your first clock-in today.',
            'location_change', false
        );
    END IF;
    
    -- If last event was at same location
    IF last_event.location_id = current_location_id THEN
        IF last_event.event_type IN ('clock_in', 'temp_in', 'transfer_in') THEN
            RETURN jsonb_build_object(
                'action', 'clock_out',
                'message', 'You are currently clocked in here. Ready to clock out?',
                'location_change', false,
                'clocked_in_since', last_event.timestamp,
                'hours_worked', EXTRACT(EPOCH FROM (now() - last_event.timestamp))/3600
            );
        ELSE
            RETURN jsonb_build_object(
                'action', 'clock_in',
                'message', 'Welcome back! Clock in to start your work.',
                'location_change', false
            );
        END IF;
    END IF;
    
    -- If last event was at different location and employee is clocked in
    IF last_event.event_type IN ('clock_in', 'temp_in', 'transfer_in') THEN
        RETURN jsonb_build_object(
            'action', 'location_transfer',
            'message', format('You are clocked in at %s. Transfer to this location?', last_event.location_name),
            'location_change', true,
            'previous_location', last_event.location_name,
            'previous_location_id', last_event.location_id,
            'hours_at_previous', EXTRACT(EPOCH FROM (now() - last_event.timestamp))/3600
        );
    ELSE
        RETURN jsonb_build_object(
            'action', 'clock_in',
            'message', 'Clock in to start your work at this location.',
            'location_change', false
        );
    END IF;
END;
$$;

-- Function to process attendance actions
CREATE OR REPLACE FUNCTION public.process_attendance_action(
    emp_id uuid,
    location_id uuid,
    device_id uuid,
    action_type text,
    confidence_score decimal DEFAULT NULL,
    notes text DEFAULT NULL,
    temp_exit_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    event_id uuid;
    previous_location_id uuid;
    result jsonb;
    temp_exit_record record;
BEGIN
    -- Handle temporary return
    IF action_type = 'temp_return' AND temp_exit_id IS NOT NULL THEN
        -- Create return event
        INSERT INTO public.attendance_events (employee_id, location_id, device_id, event_type, confidence_score, notes)
        VALUES (emp_id, location_id, device_id, 'temp_in', confidence_score, 'Returned from temporary exit')
        RETURNING id INTO event_id;
        
        -- Update temporary exit record
        UPDATE public.temporary_exits 
        SET return_event_id = event_id, 
            status = 'completed',
            actual_duration_hours = EXTRACT(EPOCH FROM (now() - (SELECT timestamp FROM public.attendance_events WHERE id = exit_event_id)))/3600
        WHERE id = temp_exit_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'action', 'temp_return',
            'message', 'Welcome back! Successfully returned from temporary exit.',
            'event_id', event_id
        );
    END IF;
    
    -- Handle location transfer
    IF action_type = 'location_transfer' THEN
        -- Get previous location
        SELECT ae.location_id INTO previous_location_id
        FROM public.attendance_events ae
        WHERE ae.employee_id = emp_id
        AND ae.event_type IN ('clock_in', 'temp_in', 'transfer_in')
        AND DATE(ae.timestamp) = CURRENT_DATE
        ORDER BY ae.timestamp DESC
        LIMIT 1;
        
        -- Clock out from previous location
        INSERT INTO public.attendance_events (employee_id, location_id, device_id, event_type, confidence_score, notes)
        VALUES (emp_id, previous_location_id, device_id, 'transfer_out', confidence_score, 'Auto transfer out');
        
        -- Clock in to current location
        INSERT INTO public.attendance_events (employee_id, location_id, device_id, event_type, confidence_score, notes)
        VALUES (emp_id, location_id, device_id, 'transfer_in', confidence_score, notes)
        RETURNING id INTO event_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'action', 'location_transfer',
            'message', 'Successfully transferred to this location.',
            'event_id', event_id
        );
    END IF;
    
    -- Handle regular clock in/out
    INSERT INTO public.attendance_events (employee_id, location_id, device_id, event_type, confidence_score, notes)
    VALUES (emp_id, location_id, device_id, action_type, confidence_score, notes)
    RETURNING id INTO event_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'action', action_type,
        'message', CASE 
            WHEN action_type = 'clock_in' THEN 'Successfully clocked in. Have a great day!'
            WHEN action_type = 'clock_out' THEN 'Successfully clocked out. See you tomorrow!'
            WHEN action_type = 'temp_out' THEN 'Temporary exit approved. Please return soon.'
            ELSE 'Action completed successfully.'
        END,
        'event_id', event_id
    );
END;
$$;

-- Function for device registration
CREATE OR REPLACE FUNCTION public.register_device(
    device_name text,
    device_code text,
    device_identifier text,
    location_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    device_id uuid;
    location_name text;
BEGIN
    -- Check if location exists
    SELECT l.location_name INTO location_name
    FROM public.locations l
    WHERE l.id = location_id AND l.is_active = true;
    
    IF location_name IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or inactive location specified'
        );
    END IF;
    
    -- Check if device code already exists
    IF EXISTS (SELECT 1 FROM public.devices WHERE device_code = register_device.device_code) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Device code already exists'
        );
    END IF;
    
    -- Register the device
    INSERT INTO public.devices (device_name, device_code, device_identifier, location_id)
    VALUES (device_name, device_code, device_identifier, location_id)
    RETURNING id INTO device_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'device_id', device_id,
        'message', format('Device successfully registered at %s', location_name)
    );
END;
$$;

-- Employee current status view
CREATE OR REPLACE VIEW public.employee_current_status AS
SELECT 
    e.id as employee_id,
    e.employee_code,
    e.full_name,
    e.face_image_url,
    e.department,
    CASE 
        WHEN latest_event.event_type IN ('clock_in', 'temp_in', 'transfer_in') THEN 'clocked_in'
        WHEN latest_event.event_type = 'temp_out' THEN 'temporary_exit'
        WHEN latest_event.event_type IN ('clock_out', 'transfer_out') THEN 'clocked_out'
        ELSE 'unknown'
    END as current_status,
    latest_event.location_id as current_location_id,
    l.location_name as current_location_name,
    latest_event.timestamp as last_activity,
    latest_event.event_type as last_event_type
FROM public.employees e
LEFT JOIN LATERAL (
    SELECT ae.*
    FROM public.attendance_events ae
    WHERE ae.employee_id = e.id
    AND DATE(ae.timestamp) = CURRENT_DATE
    ORDER BY ae.timestamp DESC
    LIMIT 1
) latest_event ON true
LEFT JOIN public.locations l ON latest_event.location_id = l.id
WHERE e.is_active = true;