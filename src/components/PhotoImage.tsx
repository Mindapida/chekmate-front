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

// Cache for photo URLs to avoid refetching
const photoCache: { [key: string]: string } = {};

// Try multiple URL patterns to find one that works
const tryLoadImage = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};

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
    const loadPhoto = async () => {
      const cacheKey = `photo_${photoId}`;
      
      // Check cache first
      if (photoCache[cacheKey]) {
        setImageUrl(photoCache[cacheKey]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      // List of URL patterns to try
      const urlPatterns = [
        // 1. Relative path through Vercel proxy
        `/${filePath}`,
        // 2. Without app/ prefix
        `/${filePath.replace('app/', '')}`,
        // 3. Direct static path
        `/static/${filePath.split('/').pop()}`,
        // 4. Full backend URL (might work if CORS is enabled)
        `https://thistimeapp.com/${filePath}`,
        // 5. API endpoint for photo
        `/api/photos/${photoId}`,
      ];

      console.log(`🖼️ Trying to load photo ${photoId}:`, fileName);

      // Try each URL pattern
      for (const url of urlPatterns) {
        console.log(`  Trying: ${url}`);
        const works = await tryLoadImage(url);
        if (works) {
          console.log(`  ✅ Success: ${url}`);
          photoCache[cacheKey] = url;
          setImageUrl(url);
          setLoading(false);
          return;
        }
      }

      // All patterns failed, try fetching via API with auth
      console.log(`  Trying API fetch with auth...`);
      try {
        const token = tokenManager.getToken();
        const response = await fetch(`/api/photos/${photoId}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('image')) {
            // Direct image response
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            console.log(`  ✅ API blob success`);
            photoCache[cacheKey] = blobUrl;
            setImageUrl(blobUrl);
            setLoading(false);
            return;
          } else {
            // JSON response - might contain a different URL
            const data = await response.json();
            console.log(`  API returned JSON:`, data);
            if (data.url || data.file_url) {
              const jsonUrl = data.url || data.file_url;
              photoCache[cacheKey] = jsonUrl;
              setImageUrl(jsonUrl);
              setLoading(false);
              return;
            }
          }
        }
      } catch (e) {
        console.log(`  API fetch failed:`, e);
      }

      // Everything failed
      console.log(`  ❌ All attempts failed for photo ${photoId}`);
      setError(true);
      setLoading(false);
    };

    loadPhoto();
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
        // If the cached URL stops working, clear cache and show error
        delete photoCache[`photo_${photoId}`];
        setError(true);
      }}
    />
  );
}

