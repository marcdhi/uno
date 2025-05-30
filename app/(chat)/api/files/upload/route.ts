import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";

const FileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 100 * 1024 * 1024, {
      message: "File size should be less than 100MB",
    })
    .refine(
      (file) => {
        const allowedTypes = [
          // Videos
          'video/mp4',
          'video/webm',
          'video/ogg',
          'video/quicktime',
          'video/x-msvideo',
          'video/x-matroska',
          // Images
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          // Audio
          'audio/mpeg',
          'audio/wav',
          'audio/ogg',
          'audio/webm',
          'audio/aac'
        ];
        return allowedTypes.includes(file.type);
      },
      {
        message: "File must be a video (MP4, WebM, etc.), image (JPEG, PNG, GIF, WebP), or audio (MP3, WAV, etc.)",
      },
    ),
});

export async function POST(request: Request) {
  try {
    // Skip auth temporarily for testing
    // const session = await auth();
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("BLOB_READ_WRITE_TOKEN is missing");
      return NextResponse.json({ error: "Storage configuration missing" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log("Attempting to upload file:", {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    try {
      // Get file content as ArrayBuffer
      const fileArrayBuffer = await file.arrayBuffer();

      // Generate a unique filename
      const timestamp = Date.now();
      const safeFilename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      console.log("Uploading to Vercel Blob:", safeFilename);

      // Upload to Vercel Blob
      const { url } = await put(safeFilename, fileArrayBuffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false // We already add timestamp
      });

      console.log("Upload successful:", url);

      return NextResponse.json({
        url,
        name: file.name,
        contentType: file.type
      });

    } catch (uploadError: any) {
      console.error("Blob upload error:", uploadError);
      return NextResponse.json({
        error: "Failed to upload to Blob storage",
        details: uploadError.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Request processing error:", error);
    return NextResponse.json({
      error: "Failed to process request",
      details: error.message
    }, { status: 500 });
  }
}
