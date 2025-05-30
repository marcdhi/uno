import { Attachment } from "ai";
import { motion } from "framer-motion";
import { Button } from "../ui/button";

interface VideoEditorModesProps {
  videoFile: Attachment | null;
  imageFiles: Attachment[];
  audioFiles: Attachment[];
  onModeSelect: (mode: "in-place" | "full-editor") => void;
  onCancel: () => void;
}

export function VideoEditorModes({ 
  videoFile, 
  imageFiles, 
  audioFiles, 
  onModeSelect, 
  onCancel 
}: VideoEditorModesProps) {
  const hasVideo = videoFile !== null;
  const hasImages = imageFiles.length > 0;
  const hasAudio = audioFiles.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-lg overflow-hidden bg-muted/50 p-4"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          {hasVideo ? "Edit Video" : "Create Video"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {hasVideo 
            ? "Choose how you'd like to edit your video:"
            : `Create a video from your ${hasImages ? "images" : ""}${hasImages && hasAudio ? " and " : ""}${hasAudio ? "audio" : ""}`
          }
        </p>
      </div>

      <div className="grid gap-4">
        <div 
          className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          onClick={() => onModeSelect("in-place")}
        >
          <h4 className="font-medium mb-1">In-place Editor (Recommended)</h4>
          <p className="text-sm text-muted-foreground">
            Quick edits using AI prompts. Perfect for simple enhancements.
          </p>
          <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Add effects and filters</li>
            <li>Change background</li>
            <li>Add text and captions</li>
            <li>Enhance audio</li>
          </ul>
        </div>

        <div 
          className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          onClick={() => onModeSelect("full-editor")}
        >
          <h4 className="font-medium mb-1">Full Editor</h4>
          <p className="text-sm text-muted-foreground">
            Complete timeline-based editor for advanced editing.
          </p>
          <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Timeline editing</li>
            <li>Multiple tracks</li>
            <li>Transitions and effects</li>
            <li>Advanced export options</li>
          </ul>
        </div>

        <div className="flex justify-end mt-2">
          <Button variant="ghost" onClick={onCancel} className="mr-2">
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );
} 