"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StyleSelector } from "./style-selector";
import { 
  Wand2, 
  Scissors, 
  Zap, 
  Type, 
  Crop, 
  RotateCw, 
  Volume2, 
  Palette,
  Clock,
  Sparkles,
  ChevronRight,
  Lightbulb
} from "lucide-react";

interface EditSuggestion {
  type: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  parameters: Record<string, any>;
  confidence: number;
}

interface SmartEditorProps {
  onEditRequest: (instruction: string, suggestions?: EditSuggestion[]) => void;
  onStyleRequest: (style: string) => void;
  onCancel: () => void;
}

export function SmartEditor({ onEditRequest, onStyleRequest, onCancel }: SmartEditorProps) {
  const [instruction, setInstruction] = useState("");
  const [suggestions, setSuggestions] = useState<EditSuggestion[]>([]);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [mode, setMode] = useState<"instruction" | "style" | "suggestions">("instruction");

  // Parse instruction and generate suggestions
  const parseInstruction = (text: string): EditSuggestion[] => {
    const suggestions: EditSuggestion[] = [];
    const lowerText = text.toLowerCase();

    // Style-based suggestions
    if (lowerText.includes("cinematic") || lowerText.includes("movie") || lowerText.includes("film")) {
      suggestions.push({
        type: "style",
        title: "Apply Cinematic Style",
        description: "Professional movie-like appearance with color grading",
        icon: <Sparkles className="w-4 h-4" />,
        parameters: { style: "cinematic" },
        confidence: 0.9
      });
    }

    if (lowerText.includes("vintage") || lowerText.includes("retro") || lowerText.includes("old")) {
      suggestions.push({
        type: "style",
        title: "Apply Vintage Style",
        description: "Retro look with warm tones and film grain",
        icon: <Sparkles className="w-4 h-4" />,
        parameters: { style: "vintage" },
        confidence: 0.85
      });
    }

    if (lowerText.includes("social") || lowerText.includes("instagram") || lowerText.includes("tiktok")) {
      suggestions.push({
        type: "style",
        title: "Social Media Style",
        description: "Optimized for social platforms",
        icon: <Sparkles className="w-4 h-4" />,
        parameters: { style: "social-media" },
        confidence: 0.9
      });
    }

    // Trim/Cut suggestions
    if (lowerText.includes("trim") || lowerText.includes("cut") || lowerText.includes("shorten")) {
      const timeMatch = text.match(/(\d+)\s*(second|minute|min|sec)/gi);
      suggestions.push({
        type: "trim",
        title: "Trim Video",
        description: timeMatch ? `Cut video based on specified time` : "Remove unwanted parts",
        icon: <Scissors className="w-4 h-4" />,
        parameters: timeMatch ? { startTime: 0, endTime: parseInt(timeMatch[0]) } : {},
        confidence: 0.8
      });
    }

    // Speed suggestions
    if (lowerText.includes("faster") || lowerText.includes("speed up") || lowerText.includes("quick")) {
      suggestions.push({
        type: "speed",
        title: "Increase Speed",
        description: "Make video play faster",
        icon: <Zap className="w-4 h-4" />,
        parameters: { speed: 1.5 },
        confidence: 0.85
      });
    }

    if (lowerText.includes("slower") || lowerText.includes("slow down") || lowerText.includes("slow motion")) {
      suggestions.push({
        type: "speed",
        title: "Slow Motion",
        description: "Make video play slower",
        icon: <Clock className="w-4 h-4" />,
        parameters: { speed: 0.5 },
        confidence: 0.85
      });
    }

    // Text suggestions
    if (lowerText.includes("text") || lowerText.includes("title") || lowerText.includes("caption") || lowerText.includes("subtitle")) {
      suggestions.push({
        type: "text",
        title: "Add Text Overlay",
        description: "Add text or captions to video",
        icon: <Type className="w-4 h-4" />,
        parameters: { position: "bottom" },
        confidence: 0.8
      });
    }

    // Brightness suggestions
    if (lowerText.includes("bright") || lowerText.includes("dark") || lowerText.includes("light")) {
      const brightness = lowerText.includes("bright") ? 20 : -20;
      suggestions.push({
        type: "brightness",
        title: lowerText.includes("bright") ? "Brighten Video" : "Darken Video",
        description: "Adjust video brightness",
        icon: <Palette className="w-4 h-4" />,
        parameters: { brightness },
        confidence: 0.75
      });
    }

    // Crop suggestions
    if (lowerText.includes("crop") || lowerText.includes("square") || lowerText.includes("portrait") || lowerText.includes("landscape")) {
      let ratio = "16:9";
      if (lowerText.includes("square")) ratio = "1:1";
      if (lowerText.includes("portrait") || lowerText.includes("vertical")) ratio = "9:16";
      
      suggestions.push({
        type: "crop",
        title: `Crop to ${ratio}`,
        description: `Change video aspect ratio to ${ratio}`,
        icon: <Crop className="w-4 h-4" />,
        parameters: { ratio },
        confidence: 0.8
      });
    }

    // Rotation suggestions
    if (lowerText.includes("rotate") || lowerText.includes("turn")) {
      suggestions.push({
        type: "rotate",
        title: "Rotate Video",
        description: "Rotate video 90 degrees",
        icon: <RotateCw className="w-4 h-4" />,
        parameters: { degrees: 90 },
        confidence: 0.8
      });
    }

    // Volume suggestions
    if (lowerText.includes("volume") || lowerText.includes("audio") || lowerText.includes("sound")) {
      const volume = lowerText.includes("loud") || lowerText.includes("up") ? 1.5 : 0.5;
      suggestions.push({
        type: "volume",
        title: lowerText.includes("loud") ? "Increase Volume" : "Decrease Volume",
        description: "Adjust audio volume",
        icon: <Volume2 className="w-4 h-4" />,
        parameters: { volume },
        confidence: 0.75
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  };

  useEffect(() => {
    if (instruction.trim()) {
      const newSuggestions = parseInstruction(instruction);
      setSuggestions(newSuggestions);
      setMode(newSuggestions.length > 0 ? "suggestions" : "instruction");
    } else {
      setSuggestions([]);
      setMode("instruction");
    }
  }, [instruction]);

  const handleApplyInstruction = () => {
    onEditRequest(instruction, suggestions);
  };

  const handleApplySuggestion = (suggestion: EditSuggestion) => {
    if (suggestion.type === "style") {
      onStyleRequest(suggestion.parameters.style);
    } else {
      onEditRequest(instruction, [suggestion]);
    }
  };

  const quickSuggestions = [
    "Make it cinematic and professional",
    "Trim the first 10 seconds and add a title",
    "Convert to square format for Instagram",
    "Add vintage filter and slow motion effect",
    "Brighten the video and enhance colors",
    "Create a social media ready version"
  ];

  if (showStyleSelector) {
    return (
      <StyleSelector
        onStyleSelect={(style) => {
          onStyleRequest(style);
          setShowStyleSelector(false);
        }}
        onCancel={() => setShowStyleSelector(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2 flex items-center justify-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          Smart Video Editor
        </h3>
        <p className="text-sm text-muted-foreground">
          Describe what you want to do with your video in natural language
        </p>
      </div>

      <div className="space-y-4">
        <Textarea
          placeholder="e.g., 'Make it cinematic, trim the first 10 seconds, and add a title at the bottom'"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          className="min-h-[100px] resize-none"
        />

        {instruction.trim() === "" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lightbulb className="w-4 h-4" />
              Quick suggestions:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {quickSuggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-left justify-start h-auto p-3"
                  onClick={() => setInstruction(suggestion)}
                >
                  <ChevronRight className="w-3 h-3 mr-2 flex-shrink-0" />
                  <span className="text-xs">{suggestion}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {mode === "suggestions" && suggestions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Suggested Actions</CardTitle>
              <CardDescription className="text-sm">
                Based on your description, here's what I can do:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {suggestions.slice(0, 4).map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleApplySuggestion(suggestion)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-primary">{suggestion.icon}</div>
                    <div>
                      <div className="font-medium text-sm">{suggestion.title}</div>
                      <div className="text-xs text-muted-foreground">{suggestion.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(suggestion.confidence * 100)}%
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowStyleSelector(true)}
            className="flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Choose Style
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyInstruction}
            disabled={!instruction.trim()}
            className="bg-primary text-white hover:bg-primary/90"
          >
            Apply Edits
          </Button>
        </div>
      </div>
    </div>
  );
} 