"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Film, Camera, Zap, Share2, Briefcase } from "lucide-react";

interface StyleOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: string;
  tags: string[];
  popular?: boolean;
}

interface StyleSelectorProps {
  onStyleSelect: (style: string) => void;
  onCancel: () => void;
}

const styles: StyleOption[] = [
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Professional movie-like appearance with color grading and smooth transitions",
    icon: <Film className="w-6 h-6" />,
    preview: "Rich colors, dramatic lighting, film-like quality",
    tags: ["Professional", "Dramatic", "High-quality"],
    popular: true
  },
  {
    id: "vintage",
    name: "Vintage",
    description: "Retro look with warm tones and film grain",
    icon: <Camera className="w-6 h-6" />,
    preview: "Sepia tones, film grain, nostalgic feel",
    tags: ["Retro", "Nostalgic", "Artistic"]
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clean, sharp look with enhanced colors",
    icon: <Zap className="w-6 h-6" />,
    preview: "Sharp details, vibrant colors, contemporary",
    tags: ["Clean", "Sharp", "Contemporary"],
    popular: true
  },
  {
    id: "social-media",
    name: "Social Media",
    description: "Optimized for social platforms with engaging visuals",
    icon: <Share2 className="w-6 h-6" />,
    preview: "Bright, engaging, mobile-optimized",
    tags: ["Bright", "Engaging", "Mobile-ready"],
    popular: true
  },
  {
    id: "professional",
    name: "Professional",
    description: "Corporate and business-ready appearance",
    icon: <Briefcase className="w-6 h-6" />,
    preview: "Clean, stable, business-appropriate",
    tags: ["Corporate", "Stable", "Business"]
  }
];

export function StyleSelector({ onStyleSelect, onCancel }: StyleSelectorProps) {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const handleStyleClick = (styleId: string) => {
    setSelectedStyle(styleId);
  };

  const handleApply = () => {
    if (selectedStyle) {
      onStyleSelect(selectedStyle);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2 flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Choose Your Video Style
        </h3>
        <p className="text-sm text-muted-foreground">
          Select a style to instantly transform your video with professional effects
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {styles.map((style) => (
          <Card
            key={style.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedStyle === style.id
                ? "ring-2 ring-primary border-primary"
                : "hover:border-primary/50"
            }`}
            onClick={() => handleStyleClick(style.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-primary">{style.icon}</div>
                  <CardTitle className="text-base">{style.name}</CardTitle>
                </div>
                {style.popular && (
                  <Badge variant="secondary" className="text-xs">
                    Popular
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-sm mb-3">
                {style.description}
              </CardDescription>
              <div className="text-xs text-muted-foreground mb-3 italic">
                {style.preview}
              </div>
              <div className="flex flex-wrap gap-1">
                {style.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={!selectedStyle}
          className="bg-primary text-white hover:bg-primary/90"
        >
          Apply Style
        </Button>
      </div>
    </div>
  );
} 