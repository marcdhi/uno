import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { LoadingState } from "./loading-state";
import { VideoIcon } from "./icons";

interface VideoUploadProps {
  onUploadComplete?: (videoUrl: string) => void;
  onUploadStart?: () => void;
}

export const VideoUpload = ({ onUploadComplete, onUploadStart }: VideoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file || !file.type.includes('video/')) {
      toast.error('Please upload a valid video file');
      return;
    }

    try {
      setIsUploading(true);
      onUploadStart?.();

      // TODO: Implement your video upload logic here
      // const response = await uploadVideo(file);
      
      // Simulate upload delay for now
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock video URL for now
      const mockVideoUrl = URL.createObjectURL(file);
      onUploadComplete?.(mockVideoUrl);
      
      toast.success('Video uploaded successfully!');
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <AnimatePresence mode="wait">
      {isUploading ? (
        <LoadingState />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="w-full"
        >
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-8
              ${dragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-zinc-200 dark:border-zinc-800 hover:border-primary/50'
              }
              transition-colors duration-200
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              accept="video/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-full bg-primary/10">
                <VideoIcon className="w-8 h-8 text-primary" />
              </div>
              
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Drop your video here or click to upload
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Supports MP4, MOV, AVI up to 2GB
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 