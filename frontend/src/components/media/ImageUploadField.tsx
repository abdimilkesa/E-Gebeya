import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES, type UploadedImage } from '@marketplace/contracts';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { Spinner } from '../ui/Spinner';

export type UploadPath = '/admin/uploads/images' | '/merchant/uploads/images';

/** Quick client-side screening; the server re-checks the real file signature and size. */
export function checkImageFile(file: File): string | null {
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) return 'Use a JPEG, PNG or WebP image.';
  if (file.size > MAX_UPLOAD_BYTES) return `Images must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`;
  return null;
}

export function useImageUpload(path: UploadPath) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File): Promise<UploadedImage | null> => {
    const problem = checkImageFile(file);
    if (problem) {
      setError(problem);
      return null;
    }
    setError(null);
    setUploading(true);
    try {
      return await api.upload<UploadedImage>(path, file);
    } catch (caught) {
      setError(errorMessage(caught, 'Upload failed. Please try again.'));
      return null;
    } finally {
      setUploading(false);
    }
  };
  return { upload, uploading, error, setError };
}

export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  uploadPath,
  aspect = 'square',
}: {
  label: string;
  hint?: string;
  value: UploadedImage | null;
  onChange: (value: UploadedImage | null) => void;
  uploadPath: UploadPath;
  aspect?: 'square' | 'wide';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const { upload, uploading, error } = useImageUpload(uploadPath);

  return (
    <div className="space-y-1.5">
      <p id={`${id}-label`} className="text-sm font-medium text-ink-800">
        {label}
      </p>
      <div className={cn('relative overflow-hidden rounded-xl border border-dashed border-ink-300 bg-ink-50', aspect === 'square' ? 'size-32' : 'aspect-[3/1] w-full')}>
        {value ? (
          <>
            <img src={value.url} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-2 top-2 rounded-lg bg-white/95 p-1.5 text-ink-700 shadow-sm hover:text-red-600"
              aria-label={`Remove ${label.toLowerCase()}`}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-labelledby={`${id}-label`}
            className="flex size-full flex-col items-center justify-center gap-1.5 text-sm text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          >
            {uploading ? <Spinner className="size-5" /> : <ImagePlus className="size-6" />}
            <span>{uploading ? 'Uploading…' : 'Upload'}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const uploaded = await upload(file);
          if (uploaded) onChange(uploaded);
        }}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : hint ? <p className="text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}
