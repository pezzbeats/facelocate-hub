-- Fix the employee_current_status view to remove SECURITY DEFINER
-- First drop the existing view
DROP VIEW IF EXISTS employee_current_status;

-- Recreate as a regular view without SECURITY DEFINER
CREATE VIEW employee_current_status AS
SELECT 
    e.id AS employee_id,
    e.employee_code,
    e.full_name,
    e.department,
    e.face_image_url,
    CASE 
        WHEN te.status = 'approved' AND te.return_event_id IS NULL THEN 'temporary_exit'
        WHEN ae.event_type IN ('clock_in', 'temp_in', 'transfer_in') THEN 'clocked_in'
        ELSE 'clocked_out'
    END AS current_status,
    ae.location_id AS current_location_id,
    l.location_name AS current_location_name,
    ae.event_type AS last_event_type,
    ae.timestamp AS last_activity
FROM employees e
LEFT JOIN LATERAL (
    SELECT * FROM attendance_events 
    WHERE employee_id = e.id 
    AND DATE(timestamp) = CURRENT_DATE
    ORDER BY timestamp DESC 
    LIMIT 1
) ae ON true
LEFT JOIN locations l ON ae.location_id = l.id
LEFT JOIN LATERAL (
    SELECT * FROM temporary_exits 
    WHERE employee_id = e.id 
    AND status = 'approved' 
    AND return_event_id IS NULL
    ORDER BY requested_at DESC 
    LIMIT 1
) te ON true
WHERE e.is_active = true;

-- Grant appropriate permissions
GRANT SELECT ON employee_current_status TO authenticated;