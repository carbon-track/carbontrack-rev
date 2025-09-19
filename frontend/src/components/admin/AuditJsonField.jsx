import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Copy, Check } from 'lucide-react';

const AuditJsonField = ({ json, title }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedJson = JSON.stringify(json, null, 2);
  const jsonString = typeof formattedJson === 'string' ? formattedJson : JSON.stringify(json, null, 2);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  return (
    <Card className="mb-3">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="h-6 w-6 p-0"
            title="Copy JSON"
          >
            {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 max-h-64 overflow-y-auto">
        {isExpanded ? (
          <pre className="text-xs font-mono bg-muted/50 rounded p-2 whitespace-pre-wrap">
            {jsonString}
          </pre>
        ) : (
          <div className="text-sm text-muted-foreground">
            Click to expand
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditJsonField;
