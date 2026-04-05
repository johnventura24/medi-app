import { Card, CardContent } from "@/components/ui/card";
import { Diamond } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <Diamond className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">404</h1>
          <h2 className="text-xl font-semibold text-foreground mt-2">Page not found</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/">
            <Button className="mt-6">Back to Home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
