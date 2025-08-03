-- Create breaks table for tracking break sessions
CREATE TABLE IF NOT EXISTS public.breaks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL,
    location_id UUID NOT NULL,
    device_id UUID NOT NULL,
    break_type TEXT NOT NULL DEFAULT 'regular', -- 'lunch', 'coffee', 'rest', 'regular'
    start_event_id UUID,
    end_event_id UUID,
    planned_duration_minutes INTEGER DEFAULT 15,
    actual_duration_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'exceeded'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT breaks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
    CONSTRAINT breaks_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
    CONSTRAINT breaks_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id),
    CONSTRAINT breaks_start_event_id_fkey FOREIGN KEY (start_event_id) REFERENCES public.attendance_events(id),
    CONSTRAINT breaks_end_event_id_fkey FOREIGN KEY (end_event_id) REFERENCES public.attendance_events(id)
);

-- Enable Row Level Security
ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;

-- Create policies for breaks table
CREATE POLICY "All users can view breaks" 
ON public.breaks 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage breaks" 
ON public.breaks 
FOR ALL 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_breaks_updated_at
BEFORE UPDATE ON public.breaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to start a break
CREATE OR REPLACE FUNCTION public.start_break(
    emp_id UUID,
    location_id UUID,
    device_id UUID,
    break_type TEXT DEFAULT 'regular',
    planned_duration INTEGER DEFAULT 15
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    break_id UUID;
    start_event_id UUID;
    result jsonb;
BEGIN
    -- Check if employee is currently checked in
    IF NOT EXISTS (
        SELECT 1 FROM public.attendance_events ae
        WHERE ae.employee_id = emp_id
        AND ae.event_type IN ('clock_in', 'temp_in', 'transfer_in')
        AND DATE(ae.timestamp) = CURRENT_DATE
        AND NOT EXISTS (
            SELECT 1 FROM public.attendance_events ae2
            WHERE ae2.employee_id = emp_id
            AND ae2.event_type IN ('clock_out', 'temp_out', 'transfer_out')
            AND ae2.timestamp > ae.timestamp
            AND DATE(ae2.timestamp) = CURRENT_DATE
        )
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Employee must be checked in to start a break'
        );
    END IF;
    
    -- Check if employee is already on break
    IF EXISTS (
        SELECT 1 FROM public.breaks
        WHERE employee_id = emp_id
        AND status = 'active'
        AND DATE(created_at) = CURRENT_DATE
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Employee is already on break'
        );
    END IF;
    
    -- Create break start event
    INSERT INTO public.attendance_events (employee_id, location_id, device_id, event_type, notes)
    VALUES (emp_id, location_id, device_id, 'break_start', 'Break started: ' || break_type)
    RETURNING id INTO start_event_id;
    
    -- Create break record
    INSERT INTO public.breaks (
        employee_id, 
        location_id, 
        device_id, 
        break_type, 
        start_event_id, 
        planned_duration_minutes
    )
    VALUES (emp_id, location_id, device_id, break_type, start_event_id, planned_duration)
    RETURNING id INTO break_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'break_id', break_id,
        'message', 'Break started successfully. Enjoy your ' || break_type || ' break!'
    );
END;
$$;

-- Create function to end a break
CREATE OR REPLACE FUNCTION public.end_break(
    emp_id UUID,
    location_id UUID,
    device_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    break_record record;
    end_event_id UUID;
    actual_duration INTEGER;
    result jsonb;
BEGIN
    -- Get active break for employee
    SELECT * INTO break_record
    FROM public.breaks
    WHERE employee_id = emp_id
    AND status = 'active'
    AND DATE(created_at) = CURRENT_DATE
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF break_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active break found for employee'
        );
    END IF;
    
    -- Create break end event
    INSERT INTO public.attendance_events (employee_id, location_id, device_id, event_type, notes)
    VALUES (emp_id, location_id, device_id, 'break_end', 'Break ended: ' || break_record.break_type)
    RETURNING id INTO end_event_id;
    
    -- Calculate actual duration
    SELECT EXTRACT(EPOCH FROM (now() - ae.timestamp))/60 INTO actual_duration
    FROM public.attendance_events ae
    WHERE ae.id = break_record.start_event_id;
    
    -- Update break record
    UPDATE public.breaks 
    SET 
        end_event_id = end_event_id,
        actual_duration_minutes = actual_duration,
        status = CASE 
            WHEN actual_duration > (planned_duration_minutes * 1.2) THEN 'exceeded'
            ELSE 'completed'
        END,
        updated_at = now()
    WHERE id = break_record.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Welcome back! Break completed.',
        'duration_minutes', actual_duration,
        'planned_duration', break_record.planned_duration_minutes,
        'exceeded', actual_duration > (break_record.planned_duration_minutes * 1.2)
    );
END;
$$;

-- Create function to request temporary exit
CREATE OR REPLACE FUNCTION public.request_temporary_exit(
    emp_id UUID,
    location_id UUID,
    device_id UUID,
    exit_reason TEXT,
    estimated_duration_hours NUMERIC DEFAULT 1.0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    temp_exit_id UUID;
    auto_approve BOOLEAN := false;
    result jsonb;
BEGIN
    -- Check if employee is currently checked in
    IF NOT EXISTS (
        SELECT 1 FROM public.attendance_events ae
        WHERE ae.employee_id = emp_id
        AND ae.event_type IN ('clock_in', 'temp_in', 'transfer_in')
        AND DATE(ae.timestamp) = CURRENT_DATE
        AND NOT EXISTS (
            SELECT 1 FROM public.attendance_events ae2
            WHERE ae2.employee_id = emp_id
            AND ae2.event_type IN ('clock_out', 'temp_out', 'transfer_out')
            AND ae2.timestamp > ae.timestamp
            AND DATE(ae2.timestamp) = CURRENT_DATE
        )
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Employee must be checked in to request temporary exit'
        );
    END IF;
    
    -- Auto-approve for certain conditions
    IF (exit_reason = 'Urgent Work' AND estimated_duration_hours <= 2.0) OR
       (exit_reason = 'Personal Emergency' AND estimated_duration_hours <= 1.0) THEN
        auto_approve := true;
    END IF;
    
    -- Create temporary exit request
    INSERT INTO public.temporary_exits (
        employee_id,
        location_id,
        reason,
        estimated_duration_hours,
        status,
        approval_time,
        approved_by
    )
    VALUES (
        emp_id,
        location_id,
        exit_reason,
        estimated_duration_hours,
        CASE WHEN auto_approve THEN 'approved' ELSE 'pending' END,
        CASE WHEN auto_approve THEN now() ELSE NULL END,
        CASE WHEN auto_approve THEN (SELECT id FROM public.admin_users WHERE role = 'super_admin' LIMIT 1) ELSE NULL END
    )
    RETURNING id INTO temp_exit_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'temp_exit_id', temp_exit_id,
        'status', CASE WHEN auto_approve THEN 'approved' ELSE 'pending' END,
        'message', CASE 
            WHEN auto_approve THEN 'Exit approved automatically. You may leave now.'
            ELSE 'Exit request submitted for approval. Please wait for admin approval.'
        END
    );
END;
$$;

-- Create function to get employee current status including breaks
CREATE OR REPLACE FUNCTION public.get_employee_current_status_with_breaks(emp_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    last_event record;
    active_break record;
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
    
    -- Check for active break
    SELECT * INTO active_break
    FROM public.breaks
    WHERE employee_id = emp_id
    AND status = 'active'
    AND DATE(created_at) = CURRENT_DATE
    ORDER BY created_at DESC
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
    
    -- Determine current status
    IF temp_exit IS NOT NULL THEN
        result := jsonb_build_object(
            'status', 'temporary_exit',
            'location_id', last_event.location_id,
            'location_name', last_event.location_name,
            'since', (SELECT timestamp FROM public.attendance_events WHERE id = temp_exit.exit_event_id),
            'temp_exit_id', temp_exit.id,
            'exit_reason', temp_exit.reason
        );
    ELSIF active_break IS NOT NULL THEN
        result := jsonb_build_object(
            'status', 'on_break',
            'location_id', active_break.location_id,
            'break_type', active_break.break_type,
            'break_id', active_break.id,
            'since', (SELECT timestamp FROM public.attendance_events WHERE id = active_break.start_event_id),
            'planned_duration', active_break.planned_duration_minutes
        );
    ELSIF last_event IS NOT NULL AND last_event.event_type IN ('clock_in', 'temp_in', 'transfer_in') THEN
        result := jsonb_build_object(
            'status', 'checked_in',
            'location_id', last_event.location_id,
            'location_name', last_event.location_name,
            'since', last_event.timestamp
        );
    ELSE
        result := jsonb_build_object(
            'status', 'checked_out'
        );
    END IF;
    
    RETURN result;
END;
$$;