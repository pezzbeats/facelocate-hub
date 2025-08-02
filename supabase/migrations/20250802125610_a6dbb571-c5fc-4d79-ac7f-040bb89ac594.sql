-- Remove the problematic view and recreate it properly
DROP VIEW IF EXISTS public.employee_current_status;

-- Recreate the view without security definer (normal view)
CREATE VIEW public.employee_current_status AS
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