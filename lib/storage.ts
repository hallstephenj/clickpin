import { supabaseAdmin } from './supabase';
import { v4 as uuidv4 } from 'uuid';

const SPROUT_PHOTOS_BUCKET = 'sprout-photos';

/**
 * Ensure the sprout-photos bucket exists
 * Creates it if it doesn't exist
 */
async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();

  const bucketExists = buckets?.some(b => b.name === SPROUT_PHOTOS_BUCKET);

  if (!bucketExists) {
    console.log('[Storage] Creating sprout-photos bucket...');
    const { error } = await supabaseAdmin.storage.createBucket(SPROUT_PHOTOS_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
    });

    if (error) {
      console.error('[Storage] Failed to create bucket:', error);
      throw new Error(`Failed to create storage bucket: ${error.message}`);
    }
    console.log('[Storage] Bucket created successfully');
  }
}

/**
 * Upload a sprout report photo to Supabase Storage
 *
 * @param base64Data - Base64-encoded image data (with or without data URL prefix)
 * @param reportId - The sprout report ID (used for organization)
 * @returns Public URL of the uploaded image
 */
export async function uploadSproutPhoto(
  base64Data: string,
  reportId: string
): Promise<string> {
  // Remove data URL prefix if present
  const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  let imageData: string;
  let mimeType: string;
  let extension: string;

  if (base64Match) {
    extension = base64Match[1];
    mimeType = `image/${extension}`;
    imageData = base64Match[2];
  } else {
    // Assume JPEG if no prefix
    extension = 'jpg';
    mimeType = 'image/jpeg';
    imageData = base64Data;
  }

  // Convert base64 to buffer
  const buffer = Buffer.from(imageData, 'base64');

  // Validate size (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    throw new Error('Image too large. Maximum size is 5MB.');
  }

  // Generate unique filename
  const filename = `${reportId}/${uuidv4()}.${extension}`;

  // Ensure bucket exists before upload
  await ensureBucketExists();

  // Upload to Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from(SPROUT_PHOTOS_BUCKET)
    .upload(filename, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('[Storage] Error uploading sprout photo:', uploadError);
    throw new Error(`Failed to upload photo: ${uploadError.message}`);
  }

  // Get public URL
  const { data } = supabaseAdmin.storage
    .from(SPROUT_PHOTOS_BUCKET)
    .getPublicUrl(filename);

  return data.publicUrl;
}

/**
 * Delete a sprout photo from storage
 *
 * @param photoUrl - The public URL of the photo to delete
 */
export async function deleteSproutPhoto(photoUrl: string): Promise<void> {
  // Extract path from URL
  const urlParts = photoUrl.split(`${SPROUT_PHOTOS_BUCKET}/`);
  if (urlParts.length < 2) {
    console.warn('Invalid photo URL, cannot delete:', photoUrl);
    return;
  }

  const path = urlParts[1];

  const { error } = await supabaseAdmin.storage
    .from(SPROUT_PHOTOS_BUCKET)
    .remove([path]);

  if (error) {
    console.error('Error deleting sprout photo:', error);
    // Don't throw - deletion failure shouldn't break the flow
  }
}
