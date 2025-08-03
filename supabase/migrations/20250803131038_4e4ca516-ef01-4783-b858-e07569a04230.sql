-- Create the security_rate_limits table first
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    operation_type text NOT NULL,
    attempt_count integer DEFAULT 1,
    last_attempt timestamp with time zone DEFAULT now(),
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, operation_type)
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