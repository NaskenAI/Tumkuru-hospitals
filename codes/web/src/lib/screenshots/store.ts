/**
 * Screenshot persistence. Uses the existing Supabase project (Storage bucket)
 * so it fits the current storage model, with an in-memory implementation for
 * tests.
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type ScreenshotStore = {
  /** Persist bytes under `key`, returning a URL/path stored on the preview row. */
  save: (input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }) => Promise<string>;
};

const BUCKET = "screenshots";

export function createSupabaseScreenshotStore(): ScreenshotStore {
  const supabase = createSupabaseServiceClient();
  return {
    async save({ key, bytes, contentType }) {
      // Ensure the (public) bucket exists; ignore "already exists".
      await supabase.storage
        .createBucket(BUCKET, { public: true })
        .catch(() => undefined);

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(key, bytes, { contentType, upsert: true });
      if (error) {
        throw new Error(`Screenshot upload failed: ${error.message}`);
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
      return data.publicUrl;
    },
  };
}

export function createInMemoryScreenshotStore(): {
  store: ScreenshotStore;
  saved: Map<string, Uint8Array>;
} {
  const saved = new Map<string, Uint8Array>();
  return {
    saved,
    store: {
      async save({ key, bytes }) {
        saved.set(key, bytes);
        return `memory://${BUCKET}/${key}`;
      },
    },
  };
}
