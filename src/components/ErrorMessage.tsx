import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  className?: string;
}

const ErrorMessage = ({ 
  title = "Something went wrong", 
  message, 
  onRetry, 
  onGoHome,
  className 
}: ErrorMessageProps) => {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p>{message}</p>
          <div className="flex gap-2">
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                className="bg-background hover:bg-muted"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            {onGoHome && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onGoHome}
                className="bg-background hover:bg-muted"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ErrorMessage;