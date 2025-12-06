import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface ScreenshotUploadProps {
  screenshotUrl: string | null;
  onUpload: (url: string | null) => void;
  disabled?: boolean;
}

export function ScreenshotUpload({ screenshotUrl, onUpload, disabled }: ScreenshotUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("trade-screenshots")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("trade-screenshots")
        .getPublicUrl(fileName);

      onUpload(urlData.publicUrl);
      toast({
        title: "Screenshot uploaded",
        description: "Your chart screenshot has been saved.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload screenshot",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!screenshotUrl || !user) return;

    try {
      // Extract file path from URL
      const urlParts = screenshotUrl.split("/trade-screenshots/");
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        await supabase.storage.from("trade-screenshots").remove([filePath]);
      }
      onUpload(null);
      toast({
        title: "Screenshot removed",
        description: "The screenshot has been deleted.",
      });
    } catch (error: any) {
      console.error("Remove error:", error);
      // Still remove from form even if storage delete fails
      onUpload(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Chart Screenshot</Label>
      
      {screenshotUrl ? (
        <div className="relative group">
          <img
            src={screenshotUrl}
            alt="Trade screenshot"
            className="w-full h-48 object-cover rounded-lg border border-border"
          />
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`
            border-2 border-dashed border-border rounded-lg p-6
            flex flex-col items-center justify-center gap-2
            transition-colors
            ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 cursor-pointer"}
          `}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <div className="p-3 rounded-full bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Upload screenshot</p>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={disabled}>
                <Upload className="mr-2 h-4 w-4" />
                Select Image
              </Button>
            </>
          )}
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
    </div>
  );
}
