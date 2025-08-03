-- Fix the register_device function to resolve ambiguous column reference
CREATE OR REPLACE FUNCTION public.register_device(device_name text, device_code text, device_identifier text, location_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    
    -- Check if device code already exists (qualify the table name)
    IF EXISTS (SELECT 1 FROM public.devices d WHERE d.device_code = register_device.device_code) THEN
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
$function$;