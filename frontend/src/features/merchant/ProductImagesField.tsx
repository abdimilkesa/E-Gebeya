import { ALLOWED_IMAGE_MIME_TYPES, MAX_PRODUCT_IMAGES, type UploadedImage } from '@marketplace/contracts';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useImageUpload } from '../../components/media/ImageUploadField';
import { Spinner } from '../../components/ui/Spinner';

/** Up to five photos; the first one is the cover shown in listings. */
export function ProductImagesField({
  value,
  onChange,
  error,
}: {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error: uploadError } = useImageUpload('/merchant/uploads/images');
  const remaining = MAX_PRODUCT_IMAGES - value.length;

  const addFiles = async (files: File[]) => {
    let next = value;
    for (const file of files.slice(0, remaining)) {
      const uploaded = await upload(file);
      if (uploaded) next = [...next, uploaded];
    }
    if (next !== value) onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {value.map((image, index) => (
          <div key={image.publicId} className="group relative size-28 overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
            <img src={image.url} alt={`Product photo ${index + 1}`} className="size-full object-cover" />
            {index === 0 ? (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-ink-950 px-2 py-0.5 text-[11px] font-medium text-white">Cover</span>
            ) : null}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1">
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => onChange([image, ...value.filter((item) => item.publicId !== image.publicId)])}
                  className="rounded-lg bg-white/95 p-1.5 text-ink-700 shadow-sm hover:text-accent-700"
                  aria-label={`Make photo ${index + 1} the cover`}
                  title="Make cover"
                >
                  <Star className="size-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item.publicId !== image.publicId))}
                className="rounded-lg bg-white/95 p-1.5 text-ink-700 shadow-sm hover:text-red-600"
                aria-label={`Remove photo ${index + 1}`}
                title="Remove"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex size-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-ink-50 text-sm text-ink-500 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-60"
          >
            {uploading ? <Spinner className="size-5" /> : <ImagePlus className="size-6" />}
            <span>{uploading ? 'Uploading…' : 'Add photo'}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) void addFiles(files);
        }}
      />
      {uploadError || error ? (
        <p className="text-sm text-red-600">{uploadError ?? error}</p>
      ) : (
        <p className="text-sm text-ink-500">
          Up to {MAX_PRODUCT_IMAGES} photos, JPEG, PNG or WebP, 5 MB each. The first photo is the cover.
        </p>
      )}
    </div>
  );
}
