import { Attachment } from "ai";
import { motion } from "framer-motion";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { useState } from "react";

interface FullVideoEditorProps {
  videoFile: Attachment;
  onClose: () => void;
}

export function FullVideoEditor({ videoFile, onClose }: FullVideoEditorProps) {
  const [prompt, setPrompt] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-background z-50 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 p-4 flex justify-between items-center">
        <h2 className="text-lg font-medium">Video Editor</h2>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Preview Section */}
        <div className="md:w-2/3 p-4 flex flex-col gap-4">
          <div className="bg-muted rounded-lg aspect-video overflow-hidden">
            <video
              src={videoFile.url}
              controls
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* Prompt Input */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Enter a prompt to edit the video..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1"
            />
            <Button className="shrink-0">Apply</Button>
          </div>
        </div>

        {/* Timeline and Controls */}
        <div className="md:w-1/3 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800">
          <div className="p-4">
            <h3 className="font-medium mb-4">Timeline</h3>
            <div className="bg-muted rounded-lg p-4 h-[200px] flex items-center justify-center text-zinc-500">
              Timeline interface coming soon...
            </div>
          </div>

          {/* Tools Panel */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="font-medium mb-4">Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="w-full" disabled>Cut</Button>
              <Button variant="outline" className="w-full" disabled>Trim</Button>
              <Button variant="outline" className="w-full" disabled>Split</Button>
              <Button variant="outline" className="w-full" disabled>Effects</Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 