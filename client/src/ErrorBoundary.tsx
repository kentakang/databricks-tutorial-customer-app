import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@databricks/appkit-ui/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error details:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background p-4">
          <Card className="mx-auto mt-8 max-w-lg">
            <CardHeader>
              <CardTitle>화면을 표시하지 못했습니다</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
              </p>
              <Button onClick={() => window.location.reload()}>다시 시도</Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
