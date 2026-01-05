import { useState, useEffect } from 'react';
import { tokenManager } from '../api/client';

interface PhotoImageProps {
  photoId: number;
  filePath: string;
  fileName: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

// Cache for blob URLs
const blobCache: Record<string, string> = {};

export default function PhotoImage({ 
  photoId, 
  filePath, 
  fileName, 
  alt = '', 
  className = '',
  onClick 
}: PhotoImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      const cacheKey = `photo_${photoId}`;
      
      // Check cache
      if (blobCache[cacheKey]) {
        setImageUrl(blobCache[cacheKey]);
        setLoading(false);
        return;
      }

      // Clean up file path
      const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      
      // URL patterns to try (through Vercel proxy)
      const urls = [
        `/${cleanPath}`,
        `/${cleanPath.replace('app/', '')}`,
        `/static/${cleanPath.split('/').pop()}`,
      ];

      console.log(`🖼️ PhotoImage ${photoId}: Loading...`, { filePath, urls });

      // Try each URL
      for (const url of urls) {
        try {
          console.log(`  Trying: ${url}`);
          const response = await fetch(url);
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            
            if (contentType?.startsWith('image/')) {
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              blobCache[cacheKey] = blobUrl;
              setImageUrl(blobUrl);
              setLoading(false);
              console.log(`  ✅ Success: ${url}`);
              return;
            }
          }
        } catch (e) {
          console.log(`  ❌ Failed: ${url}`);
        }
      }

      // Try API endpoint with auth token
      try {
        console.log(`  Trying API: /api/photos/${photoId}/image`);
        const token = tokenManager.getToken();
        const response = await fetch(`/api/photos/${photoId}/image`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType?.startsWith('image/')) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            blobCache[cacheKey] = blobUrl;
            setImageUrl(blobUrl);
            setLoading(false);
            console.log(`  ✅ API Success`);
            return;
          }
        }
      } catch (e) {
        console.log(`  ❌ API Failed`);
      }

      // All failed
      console.log(`  ❌ All attempts failed for photo ${photoId}`);
      setError(true);
      setLoading(false);
    };

    loadImage();
  }, [photoId, filePath]);

  if (loading) {
    return (
      <div className={`photo-loading ${className}`} onClick={onClick}>
        <div className="loading-spinner">⏳</div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`photo-error ${className}`} onClick={onClick}>
        <div className="error-icon">🖼️</div>
        <span className="error-filename">{fileName}</span>
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt={alt || fileName}
      className={className}
      onClick={onClick}
      onError={() => {
        delete blobCache[`photo_${photoId}`];
        setError(true);
      }}
    />
  );
}

