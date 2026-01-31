/**
 * File Upload API Route
 * 
 * Handles file uploads and returns the file URL.
 * For demo purposes, returns a data URL. In production, this would
 * upload to cloud storage (S3, etc.) and return the actual URL.
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fieldId = formData.get('fieldId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // For demo purposes, create a data URL from the file
    // In production, upload to cloud storage and return the actual URL
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'application/octet-stream';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Return the data URL as the file URL
    // In production, this would be something like: https://storage.example.com/files/abc123.pdf
    return NextResponse.json({
      url: dataUrl,
      fieldId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
