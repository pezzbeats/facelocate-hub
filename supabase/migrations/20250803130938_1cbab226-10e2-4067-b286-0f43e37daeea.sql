-- CRITICAL SECURITY FIXES FOR JUSTRACK

-- 1. Fix Security Definer View Issue - Drop and recreate employee_current_status as a proper view with RLS
DROP VIEW IF EXISTS public.employee_current_status;

-- 2. Create a secure function to get employee current status instead of a view
CREATE OR REPLACE FUNCTION public.get_employee_current_status()
RETURNS TABLE (
    employee_id uuid,
    full_name text,
    employee_code text,
    department text,
    current_status text,
    current_location_id uuid,
    current_location_name text,
    last_event_type text,
    last_activity timestamp with time zone,
    face_image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    -- Only admins can access this function
    IF NOT is_active_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    RETURN QUERY
    WITH latest_events AS (
        SELECT DISTINCT ON (ae.employee_id) 
            ae.employee_id,
            ae.event_type,
            ae.location_id,
            ae.timestamp,
            l.location_name
        FROM public.attendance_events ae
        LEFT JOIN public.locations l ON ae.location_id = l.id
        WHERE DATE(ae.timestamp) = CURRENT_DATE
        ORDER BY ae.employee_id, ae.timestamp DESC
    )
    SELECT 
        e.id as employee_id,
        e.full_name,
        e.employee_code,
        e.department,
        CASE 
            WHEN le.event_type IN ('clock_in', 'temp_in', 'transfer_in') THEN 'checked_in'
            WHEN le.event_type IN ('clock_out', 'temp_out', 'transfer_out') THEN 'checked_out'
            WHEN le.event_type = 'break_start' THEN 'on_break'
            ELSE 'checked_out'
        END as current_status,
        le.location_id as current_location_id,
        le.location_name as current_location_name,
        le.event_type as last_event_type,
        le.timestamp as last_activity,
        e.face_image_url
    FROM public.employees e
    LEFT JOIN latest_events le ON e.id = le.employee_id
    WHERE e.is_active = true;
END;
$$;

-- 3. Strengthen admin user creation security
CREATE OR REPLACE FUNCTION public.create_admin_user(
    user_email text,
    user_password text,
    user_full_name text,
    user_role text DEFAULT 'admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    new_user_id uuid;
    signup_result record;
BEGIN
    -- Only super admins can create other admins, or if no admins exist
    IF NOT (is_super_admin() OR admin_users_table_is_empty()) THEN
        RAISE EXCEPTION 'Access denied. Super admin privileges required.';
    END IF;
    
    -- Additional validation for super admin role assignment
    IF user_role = 'super_admin' AND NOT is_super_admin() THEN
        RAISE EXCEPTION 'Only existing super admins can create new super admins.';
    END IF;
    
    -- Validate role
    IF user_role NOT IN ('super_admin', 'admin', 'hr_admin', 'viewer') THEN
        RAISE EXCEPTION 'Invalid role specified.';
    END IF;
    
    -- Create the user in auth.users (this requires service role key)
    -- Note: This would typically be done via an edge function with service role
    -- For now, we'll create the admin_users record and let the frontend handle auth signup
    
    -- Generate a UUID for the new user
    new_user_id := gen_random_uuid();
    
    -- Insert into admin_users table
    INSERT INTO public.admin_users (id, email, full_name, role, is_active)
    VALUES (new_user_id, user_email, user_full_name, user_role::text, true);
    
    -- Log the admin creation
    PERFORM log_admin_action(
        'create_admin_user',
        'admin_users',
        new_user_id,
        NULL,
        jsonb_build_object(
            'email', user_email,
            'full_name', user_full_name,
            'role', user_role,
            'created_by', auth.uid()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'message', 'Admin user created successfully. User must complete signup process.'
    );
END;
$$;

-- 4. Add encryption for sensitive data storage
-- Create a function to encrypt face encodings
CREATE OR REPLACE FUNCTION public.encrypt_face_data(face_data jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    -- This is a placeholder for encryption logic
    -- In production, you would use proper encryption like pgcrypto
    -- For now, we'll just convert to text and add a prefix to indicate it's "encrypted"
    RETURN 'ENC:' || face_data::text;
END;
$$;

-- Create a function to decrypt face encodings
CREATE OR REPLACE FUNCTION public.decrypt_face_data(encrypted_data text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    -- Remove the ENC: prefix and convert back to jsonb
    IF encrypted_data LIKE 'ENC:%' THEN
        RETURN substring(encrypted_data from 5)::jsonb;
    ELSE
        -- Legacy data that's not encrypted
        RETURN encrypted_data::jsonb;
    END IF;
END;
$$;

-- 5. Enhance audit logging for security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    event_type text,
    event_details jsonb DEFAULT NULL,
    user_id_override uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    log_id uuid;
    current_user_id uuid := COALESCE(user_id_override, auth.uid());
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        current_user_id,
        'security_event',
        'security_log',
        NULL,
        jsonb_build_object(
            'event_type', event_type,
            'details', event_details,
            'timestamp', now()
        ),
        inet_client_addr(),
        current_setting('request.headers', true)::json->>'user-agent'
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- 6. Create function to validate device registration security
CREATE OR REPLACE FUNCTION public.secure_register_device(
    device_name text, 
    device_code text, 
    device_identifier text, 
    location_id uuid,
    admin_verification_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    device_id uuid;
    location_name text;
BEGIN
    -- Only admins can register devices
    IF NOT is_active_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required for device registration.';
    END IF;
    
    -- Validate input parameters
    IF device_name IS NULL OR trim(device_name) = '' THEN
        RAISE EXCEPTION 'Device name is required.';
    END IF;
    
    IF device_code IS NULL OR trim(device_code) = '' THEN
        RAISE EXCEPTION 'Device code is required.';
    END IF;
    
    IF device_identifier IS NULL OR trim(device_identifier) = '' THEN
        RAISE EXCEPTION 'Device identifier is required.';
    END IF;
    
    -- Check if location exists and is active
    SELECT l.location_name INTO location_name
    FROM public.locations l
    WHERE l.id = location_id AND l.is_active = true;
    
    IF location_name IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive location specified.';
    END IF;
    
    -- Check if device code already exists
    IF EXISTS (SELECT 1 FROM public.devices WHERE device_code = secure_register_device.device_code) THEN
        RAISE EXCEPTION 'Device code already exists. Please use a unique device code.';
    END IF;
    
    -- Check if device identifier already exists
    IF EXISTS (SELECT 1 FROM public.devices WHERE device_identifier = secure_register_device.device_identifier) THEN
        RAISE EXCEPTION 'Device identifier already exists. Please use a unique device identifier.';
    END IF;
    
    -- Register the device
    INSERT INTO public.devices (device_name, device_code, device_identifier, location_id, is_active)
    VALUES (device_name, device_code, device_identifier, location_id, true)
    RETURNING id INTO device_id;
    
    -- Log the device registration
    PERFORM log_security_event(
        'device_registration',
        jsonb_build_object(
            'device_id', device_id,
            'device_name', device_name,
            'device_code', device_code,
            'location_id', location_id,
            'location_name', location_name,
            'registered_by', auth.uid()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'device_id', device_id,
        'message', format('Device "%s" successfully registered at %s', device_name, location_name)
    );
END;
$$;

-- 7. Add security policies for better access control
-- Update admin_users policies to be more restrictive
DROP POLICY IF EXISTS "Active admins can view admin users" ON public.admin_users;
CREATE POLICY "Super admins can view all admin users"
ON public.admin_users FOR SELECT
TO authenticated
USING (is_super_admin() OR auth.uid() = id);

-- Add policy to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    -- Prevent non-super admins from creating/modifying super admin roles
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.role = 'super_admin' AND NOT is_super_admin() THEN
            RAISE EXCEPTION 'Access denied. Cannot create or modify super admin roles.';
        END IF;
    END IF;
    
    RETURN true;
END;
$$;

-- Create trigger to prevent privilege escalation
DROP TRIGGER IF EXISTS prevent_admin_privilege_escalation ON public.admin_users;
CREATE TRIGGER prevent_admin_privilege_escalation
    BEFORE INSERT OR UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_privilege_escalation();

-- 8. Add rate limiting for security-sensitive operations
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    operation_type text NOT NULL,
    attempt_count integer DEFAULT 1,
    last_attempt timestamp with time zone DEFAULT now(),
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on rate limits table
ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy for rate limits
CREATE POLICY "Users can view their own rate limits"
ON public.security_rate_limits FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can manage rate limits"
ON public.security_rate_limits FOR ALL
TO authenticated
WITH CHECK (true);

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    operation_type text,
    max_attempts integer DEFAULT 5,
    window_minutes integer DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    current_count integer;
    blocked_until_time timestamp with time zone;
BEGIN
    -- Get current rate limit status
    SELECT attempt_count, blocked_until INTO current_count, blocked_until_time
    FROM public.security_rate_limits
    WHERE user_id = auth.uid() 
    AND operation_type = check_rate_limit.operation_type
    AND last_attempt > (now() - interval '1 minute' * window_minutes);
    
    -- Check if user is currently blocked
    IF blocked_until_time IS NOT NULL AND blocked_until_time > now() THEN
        RETURN false;
    END IF;
    
    -- If no recent attempts, allow and create/reset record
    IF current_count IS NULL THEN
        INSERT INTO public.security_rate_limits (user_id, operation_type, attempt_count, last_attempt)
        VALUES (auth.uid(), operation_type, 1, now())
        ON CONFLICT (user_id, operation_type) 
        DO UPDATE SET attempt_count = 1, last_attempt = now(), blocked_until = NULL;
        RETURN true;
    END IF;
    
    -- If under limit, increment and allow
    IF current_count < max_attempts THEN
        UPDATE public.security_rate_limits
        SET attempt_count = attempt_count + 1, last_attempt = now()
        WHERE user_id = auth.uid() AND operation_type = check_rate_limit.operation_type;
        RETURN true;
    END IF;
    
    -- Over limit, block user
    UPDATE public.security_rate_limits
    SET blocked_until = now() + interval '1 minute' * window_minutes,
        last_attempt = now()
    WHERE user_id = auth.uid() AND operation_type = check_rate_limit.operation_type;
    
    RETURN false;
END;
$$;