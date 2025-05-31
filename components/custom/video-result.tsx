"use client";

import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";

interface VideoResultProps {
  result: {
    success?: boolean;
    videoUrl?: string;
    editedVideoUrl?: string;
    message?: string;
    error?: string;
    duration?: string;
    operation?: string;
  };
  toolName?: string;
}

export function VideoResult({ result }: VideoResultProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  
  if (!result.success || result.error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
        <p className="text-sm text-red-800 dark:text-red-200">
          {result.error || "Something went wrong"}
        </p>
      </div>
    );
  }

  const videoUrl = result.editedVideoUrl || result.videoUrl;
  
  if (!videoUrl) {
    return (
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        {result.message || "Processing complete"}
      </div>
    );
  }

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const openInNewTab = () => {
    window.open(videoUrl, '_blank');
  };

  return (
    <div className="space-y-3">
      {/* Video Preview */}
      <div className="rounded-lg overflow-hidden bg-muted/50">
        <video
          src={videoUrl}
          controls
          className="w-full h-auto"
          style={{ maxHeight: '400px' }}
          preload="metadata"
        />
      </div>

      {/* Simple Actions */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDownload}
          disabled={isDownloading}
          className="text-sm"
        >
          <Download className="h-4 w-4 mr-1" />
          {isDownloading ? "Downloading..." : "Download"}
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={openInNewTab}
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Open
        </Button>
      </div>

      {/* Optional message */}
      {result.message && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {result.message}
        </p>
      )}
    </div>
  );
} 